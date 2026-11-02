package com.petcare.backend.notification;

import java.util.List;

/**
 * Sprint 6: transport abstraction for push delivery.
 * Implementations: {@link ExpoPushSender} (primary, via Expo Push Service -> FCM/APNs)
 * and {@link FcmPushSender} (fallback for raw FCM tokens, firebase-admin HTTP v1).
 */
public interface PushSender {

    /** True when this sender can handle the given device token. */
    boolean supports(String token);

    /**
     * Sends a push to all supplied tokens. Returns the tokens that were NOT delivered
     * (exception-free API so the scheduler can mark notifications failed and retry later).
     */
    List<String> send(List<String> tokens, String title, String body, String payloadJson);
}
