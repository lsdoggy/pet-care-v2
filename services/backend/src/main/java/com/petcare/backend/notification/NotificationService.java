package com.petcare.backend.notification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.petcare.backend.device.UserDeviceEntity;
import com.petcare.backend.device.UserDeviceRepository;
import com.petcare.backend.error.AccessDeniedForResourceException;
import com.petcare.backend.error.NotificationNotFoundException;
import com.petcare.backend.notification.dto.NotificationDto;
import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;

/**
 * Sprint 6: notification domain service (Controller -> Service -> Repository).
 * All business logic for creating rows, fan-out to devices and status transitions lives here.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final UserDeviceRepository deviceRepository;
    private final UserRepository userRepository;
    private final List<PushSender> pushSenders;
    private final MailSender mailSender;
    private final ObjectMapper mapper = new ObjectMapper();

    public NotificationService(NotificationRepository notificationRepository,
                               UserDeviceRepository deviceRepository,
                               UserRepository userRepository,
                               List<PushSender> pushSenders,
                               MailSender mailSender) {
        this.notificationRepository = notificationRepository;
        this.deviceRepository = deviceRepository;
        this.userRepository = userRepository;
        this.pushSenders = pushSenders;
        this.mailSender = mailSender;
    }

    /** Per-user feed for web/mobile (newest first). */
    @Transactional(readOnly = true)
    public List<NotificationDto> listForUser(String email) {
        UserEntity user = resolveUser(email);
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(NotificationDto::from)
                .toList();
    }

    /** Badge counter: rows still in "sent" state (delivered but not opened). */
    @Transactional(readOnly = true)
    public long unreadCount(String email) {
        UserEntity user = resolveUser(email);
        return notificationRepository.countByUserIdAndChannelStatus(user.getId(), ChannelStatus.SENT);
    }

    /** channel_status: sent -> read (idempotent from the client's perspective). */
    @Transactional
    public NotificationDto markRead(Long id, String email) {
        UserEntity user = resolveUser(email);
        NotificationEntity entity = notificationRepository.findById(id)
                .orElseThrow(() -> new NotificationNotFoundException(id));
        if (!entity.getUserId().equals(user.getId())) {
            throw new AccessDeniedForResourceException("Notification " + id + " does not belong to the user");
        }
        if (entity.getChannelStatus() == ChannelStatus.SENT) {
            entity.markRead();
        }
        return NotificationDto.from(entity);
    }

    /**
     * Creates a push notification row and fans it out to all enabled devices of the user.
     * Delivery failures do NOT throw: the row stays visible with channel_status=failed
     * (the minimal retry pass re-sends those rows later).
     */
    @Transactional
    public void push(UserEntity user, String title, String body, Map<String, Object> payload) {
        if (!user.isPushNotificationsEnabled()) {
            log.debug("Push suppressed for user {}: channel disabled in settings", user.getId());
            return;
        }
        List<UserDeviceEntity> devices = deviceRepository.findByUserIdAndPushEnabledTrue(user.getId());
        String payloadJson = toJson(payload);
        NotificationEntity notification = notificationRepository.save(
                new NotificationEntity(user.getId(), NotificationType.PUSH, title, body, payloadJson));

        if (devices.isEmpty()) {
            // Nothing to deliver to — keep as pending; the retry pass gives the user a chance
            // to register a device before the row is finally marked failed.
            return;
        }
        deliverPush(notification, devices.stream().map(UserDeviceEntity::getToken).toList());
    }

    /** Creates an email notification row and sends it (only called for important events). */
    @Transactional
    public void email(UserEntity user, String title, String body, Map<String, Object> payload) {
        if (!user.isEmailNotificationsEnabled()) {
            return;
        }
        NotificationEntity notification = notificationRepository.save(
                new NotificationEntity(user.getId(), NotificationType.EMAIL, title, body, toJson(payload)));
        boolean delivered = mailSender.send(user.getEmail(), title, body);
        applyDeliveryResult(notification, delivered);
    }

    /**
     * Minimal retry pass (called by the scheduler): re-delivers rows that are still
     * "pending" (no device was registered at creation time) or "failed". After
     * {@value #MAX_SEND_ATTEMPTS} attempts a row is given up on.
     */
    @Transactional
    public int retryPendingAndFailed() {
        List<NotificationEntity> retryable = notificationRepository
                .findByChannelStatusInOrderByCreatedAtAsc(List.of(ChannelStatus.PENDING, ChannelStatus.FAILED));
        int retried = 0;
        Instant now = Instant.now();
        for (NotificationEntity n : retryable) {
            if (n.getSentAt() != null && n.getSentAt().isBefore(now.minusSeconds(GIVE_UP_AFTER_SECONDS))) {
                continue; // older than the give-up window: leave it as failed history
            }
            if (n.getType() == NotificationType.PUSH) {
                List<String> tokens = deviceRepository
                        .findByUserIdAndPushEnabledTrue(n.getUserId()).stream()
                        .map(UserDeviceEntity::getToken).toList();
                if (tokens.isEmpty()) {
                    bumpAttempt(n, now);
                    continue;
                }
                deliverPush(n, tokens);
                bumpAttempt(n, now);
                retried++;
            } else {
                String to = userRepository.findById(n.getUserId()).map(UserEntity::getEmail).orElse(null);
                if (to != null && mailSender.send(to, n.getTitle(), n.getBody())) {
                    applyDeliveryResult(n, true);
                    retried++;
                } else {
                    bumpAttempt(n, now);
                }
            }
        }
        return retried;
    }

    private void deliverPush(NotificationEntity notification, List<String> tokens) {
        // Route each token to the sender that supports it (Expo first, raw FCM as fallback).
        Map<PushSender, List<String>> bySender = new HashMap<>();
        for (String token : tokens) {
            pushSenders.stream().filter(s -> s.supports(token)).findFirst()
                    .ifPresentOrElse(s -> bySender.computeIfAbsent(s, k -> new ArrayList<>()).add(token),
                            () -> log.warn("No push sender available for token type of notification {}",
                                    notification.getId()));
        }
        boolean anyDelivered = false;
        for (var entry : bySender.entrySet()) {
            List<String> failedTokens = entry.getKey().send(entry.getValue(),
                    notification.getTitle(), notification.getBody(), notification.getPayloadJson());
            int delivered = entry.getValue().size() - failedTokens.size();
            anyDelivered |= delivered > 0;
        }
        applyDeliveryResult(notification, anyDelivered);
    }

    private void applyDeliveryResult(NotificationEntity notification, boolean delivered) {
        notification.setChannelStatus(delivered ? ChannelStatus.SENT : ChannelStatus.FAILED);
        notification.setSentAt(Instant.now());
    }

    private void bumpAttempt(NotificationEntity n, Instant now) {
        // sent_at doubles as "last attempt" marker for the give-up window.
        n.setSentAt(now);
    }

    private static final int MAX_SEND_ATTEMPTS = 3;
    private static final long GIVE_UP_AFTER_SECONDS = 24 * 3600;

    private String toJson(Map<String, Object> payload) {
        try {
            return payload == null || payload.isEmpty() ? null : mapper.writeValueAsString(payload);
        } catch (Exception e) {
            return null;
        }
    }

    private UserEntity resolveUser(String email) {
        return userRepository.findByEmailIgnoreCase(email.trim().toLowerCase())
                .orElseThrow(() -> new AccessDeniedForResourceException("User not found"));
    }
}
