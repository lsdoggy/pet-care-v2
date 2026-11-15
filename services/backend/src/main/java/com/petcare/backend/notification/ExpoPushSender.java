package com.petcare.backend.notification;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Sends through Expo Push Service, which forwards notifications via FCM v1 or APNs. */
@Component
@ConditionalOnProperty(name = "app.notifications.expo.enabled", havingValue = "true", matchIfMissing = true)
public class ExpoPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(ExpoPushSender.class);
    private static final int SEND_BATCH_SIZE = 100;
    private static final int RECEIPT_BATCH_SIZE = 1000;

    private final RestClient http;
    private final ObjectMapper mapper = new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final String sendUrl;
    private final String receiptsUrl;

    @Autowired
    public ExpoPushSender(
            @Value("${app.notifications.expo.url:https://exp.host/--/api/v2/push/send}") String sendUrl,
            @Value("${app.notifications.expo.receipts-url:https://exp.host/--/api/v2/push/getReceipts}") String receiptsUrl,
            @Value("${app.notifications.expo.access-token:}") String accessToken,
            JdbcTemplate jdbc) {
        this(sendUrl, receiptsUrl, jdbc, client(accessToken));
    }

    ExpoPushSender(String sendUrl, String receiptsUrl, JdbcTemplate jdbc, RestClient http) {
        this.sendUrl = sendUrl;
        this.receiptsUrl = receiptsUrl;
        this.jdbc = jdbc;
        this.http = http;
    }

    private static RestClient client(String accessToken) {
        var requestFactory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build());
        requestFactory.setReadTimeout(Duration.ofSeconds(15));
        return RestClient.builder()
                .requestFactory(requestFactory)
                .defaultHeaders(headers -> {
                    if (!accessToken.isBlank()) {
                        headers.setBearerAuth(accessToken);
                    }
                })
                .build();
    }

    @Override
    public boolean supports(String token) {
        return token != null && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
    }

    @Override
    public List<String> send(List<String> tokens, String title, String body, String payloadJson) {
        List<String> failed = new ArrayList<>();
        for (int start = 0; start < tokens.size(); start += SEND_BATCH_SIZE) {
            var batch = tokens.subList(start, Math.min(start + SEND_BATCH_SIZE, tokens.size()));
            try {
                failed.addAll(sendBatch(batch, payloadJson));
            } catch (Exception e) {
                log.warn("Expo push send failed for {} device(s): {}", batch.size(), e.getClass().getSimpleName());
                failed.addAll(batch);
            }
        }
        return failed;
    }

    private List<String> sendBatch(List<String> tokens, String payloadJson) throws Exception {
        var data = pushData(payloadJson);
        List<Map<String, Object>> messages = tokens.stream()
                .map(token -> Map.<String, Object>of("to", token,
                        "title", "Pet Care", "body", "Откройте приложение, чтобы посмотреть напоминание.",
                        "channelId", "reminders", "data", data))
                .toList();
        OffsetDateTime sentAt = Instant.now().atOffset(ZoneOffset.UTC);
        JsonNode tickets = post(sendUrl, messages);
        List<String> failed = new ArrayList<>();
        for (int i = 0; i < tokens.size(); i++) {
            JsonNode ticket = tickets.path(i);
            String token = tokens.get(i);
            if ("ok".equals(ticket.path("status").asText()) && ticket.hasNonNull("id")) {
                jdbc.update("INSERT INTO expo_push_receipts (id, token, sent_at) VALUES (?, ?, ?)",
                        ticket.path("id").asText(), token, sentAt);
            } else {
                handleError(ticket, token, sentAt);
                failed.add(token);
            }
        }
        return failed;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void checkReceipts() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbc.update("DELETE FROM expo_push_receipts WHERE sent_at <= ?", now.minusHours(24));
        List<Receipt> receipts = jdbc.query("""
                SELECT id, token, sent_at FROM expo_push_receipts
                WHERE sent_at <= ? ORDER BY sent_at FETCH FIRST ? ROWS ONLY
                """, (row, i) -> new Receipt(row.getString("id"), row.getString("token"),
                row.getObject("sent_at", OffsetDateTime.class)), now.minusMinutes(15), RECEIPT_BATCH_SIZE);
        if (receipts.isEmpty()) {
            return;
        }
        try {
            JsonNode results = post(receiptsUrl, Map.of("ids", receipts.stream().map(Receipt::id).toList()));
            for (Receipt receipt : receipts) {
                JsonNode result = results.path(receipt.id());
                if (!result.isMissingNode()) {
                    handleError(result, receipt.token(), receipt.sentAt());
                    jdbc.update("DELETE FROM expo_push_receipts WHERE id = ?", receipt.id());
                }
            }
        } catch (Exception e) {
            log.warn("Expo push receipt check failed: {}", e.getClass().getSimpleName());
        }
    }

    private JsonNode post(String url, Object body) throws Exception {
        String response = http.post().uri(url).contentType(MediaType.APPLICATION_JSON)
                .body(mapper.writeValueAsBytes(body))
                .retrieve().body(String.class);
        return mapper.readTree(response).path("data");
    }

    private void handleError(JsonNode response, String token, OffsetDateTime sentAt) {
        String error = response.path("details").path("error").asText();
        if ("DeviceNotRegistered".equals(error)) {
            jdbc.update("UPDATE user_devices SET push_enabled = FALSE WHERE token = ? AND last_seen_at <= ?",
                    token, sentAt);
        } else if (!"ok".equals(response.path("status").asText())) {
            log.warn("Expo push rejected a notification (provider status {})",
                    switch (error) {
                        case "MessageTooBig", "MessageRateExceeded", "MismatchSenderId", "InvalidCredentials" -> error;
                        default -> "unknown";
                    });
        }
    }

    private Map<String, Object> pushData(String payloadJson) throws Exception {
        if (payloadJson == null || payloadJson.isBlank()) {
            return Map.of();
        }
        JsonNode payload = mapper.readTree(payloadJson);
        if ("low_stock".equals(payload.path("type").asText())) {
            return Map.of("route", "stock");
        }
        JsonNode task = payload.path("careTaskId");
        return task.isIntegralNumber() && task.canConvertToLong()
                ? Map.of("route", "tasks", "careTaskId", task.longValue())
                : Map.of();
    }

    private record Receipt(String id, String token, OffsetDateTime sentAt) {}
}
