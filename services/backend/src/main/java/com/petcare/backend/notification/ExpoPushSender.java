package com.petcare.backend.notification;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Sprint 6: primary push transport — Expo Push Service (https://exp.host/--/api/v2/push/send).
 * Expo forwards the message to FCM (Android) / APNs (iOS), so no google-services.json or
 * FCM service account is required for Expo builds. Enabled by default; disable with
 * app.notifications.expo.enabled=false. Failures are logged, never thrown (MVP retry lives
 * in NotificationService).
 */
@Component
@ConditionalOnProperty(name = "app.notifications.expo.enabled", havingValue = "true", matchIfMissing = true)
public class ExpoPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(ExpoPushSender.class);
    private static final String SEND_URL = "https://exp.host/--/api/v2/push/send";

    private final RestClient http;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String accessToken;

    public ExpoPushSender(
            @org.springframework.beans.factory.annotation.Value("${app.notifications.expo.url:" + SEND_URL + "}") String url,
            @org.springframework.beans.factory.annotation.Value("${app.notifications.expo.access-token:}") String accessToken) {
        this.accessToken = accessToken;
        // Default RestClient factory (JDK HttpClient in Spring Framework 7) with sane timeouts.
        var requestFactory = new org.springframework.http.client.JdkClientHttpRequestFactory(
                java.net.http.HttpClient.newBuilder()
                        .connectTimeout(java.time.Duration.ofSeconds(10))
                        .build());
        requestFactory.setReadTimeout(java.time.Duration.ofSeconds(15));
        this.http = RestClient.builder()
                .baseUrl(url)
                .requestFactory(requestFactory)
                .build();
    }

    @Override
    public boolean supports(String token) {
        return token != null && token.startsWith("ExponentPushToken[");
    }

    @Override
    public List<String> send(List<String> tokens, String title, String body, String payloadJson) {
        List<String> failed = new ArrayList<>();
        if (tokens.isEmpty()) {
            return failed;
        }
        try {
            List<Map<String, Object>> messages = tokens.stream()
                    .map(t -> Map.<String, Object>of(
                            "to", t,
                            "title", title,
                            "body", body,
                            "data", parseData(payloadJson)))
                    .toList();
            String json = mapper.writeValueAsString(messages);
            String response = http.post()
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + accessToken)
                    .body(json)
                    .retrieve()
                    .body(String.class);
            JsonNode root = mapper.readTree(response == null ? "{}" : response);
            JsonNode data = root.path("data");
            int idx = 0;
            for (JsonNode ticket : data) {
                if (idx < tokens.size() && !"ok".equals(ticket.path("status").asText())) {
                    log.warn("Expo push rejected for token {}: {}", mask(tokens.get(idx)),
                            ticket.path("message").asText("unknown error"));
                    failed.add(tokens.get(idx));
                }
                idx++;
            }
        } catch (Exception e) {
            log.error("Expo push batch failed for {} token(s): {}", tokens.size(), e.getMessage());
            failed.addAll(tokens);
        }
        return failed;
    }

    private Map<String, Object> parseData(String payloadJson) {
        if (payloadJson == null || payloadJson.isBlank()) {
            return Map.of();
        }
        try {
            JsonNode node = mapper.readTree(payloadJson);
            return mapper.convertValue(node,
                    mapper.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
        } catch (Exception e) {
            return Map.of("payload", payloadJson);
        }
    }

    private static String mask(String token) {
        return token.length() <= 12 ? token : token.substring(0, 8) + "…";
    }
}
