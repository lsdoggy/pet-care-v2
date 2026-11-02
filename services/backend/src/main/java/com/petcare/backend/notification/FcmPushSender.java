package com.petcare.backend.notification;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Sprint 6: optional fallback transport for RAW FCM registration tokens (native builds).
 *
 * <p>Per the approved plan the primary push path is {@link ExpoPushSender} (Expo Push Service
 * forwards to FCM/APNs), so NO firebase-admin dependency and no google-services.json are needed.
 * This bean only activates when {@code app.notifications.fcm.enabled=true}; without it the
 * application runs with zero Firebase credentials, which keeps dev/test environments clean.
 * A full firebase-admin HTTP v1 client can be dropped in here later without touching
 * {@link NotificationService} (the {@link PushSender} contract stays stable).
 */
@Component
@ConditionalOnProperty(name = "app.notifications.fcm.enabled", havingValue = "true")
public class FcmPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(FcmPushSender.class);

    public FcmPushSender() {
        log.warn("FcmPushSender enabled (app.notifications.fcm.enabled=true) but this MVP build "
                + "ships no firebase-admin client; raw FCM tokens will be reported as failed. "
                + "Use Expo push tokens or disable this flag.");
    }

    @Override
    public boolean supports(String token) {
        // Anything that is not an Expo token is assumed to be a raw FCM registration token.
        return token != null && !token.startsWith("ExponentPushToken[");
    }

    @Override
    public List<String> send(List<String> tokens, String title, String body, String payloadJson) {
        // Fail fast and explicitly — the scheduler marks these notifications as failed and retries.
        return new ArrayList<>(tokens);
    }
}
