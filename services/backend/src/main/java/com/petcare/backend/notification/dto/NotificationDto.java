package com.petcare.backend.notification.dto;

import java.time.Instant;

import com.petcare.backend.notification.ChannelStatus;
import com.petcare.backend.notification.NotificationEntity;
import com.petcare.backend.notification.NotificationType;

/** One row of the per-user notification feed (GET /api/v1/notifications). */
public record NotificationDto(
        Long id,
        NotificationType type,
        String title,
        String body,
        /** Raw JSON string with extra context, e.g. {"careTaskId":42,"dueAt":"..."}. */
        String payloadJson,
        ChannelStatus channelStatus,
        Instant sentAt,
        Instant createdAt) {

    public static NotificationDto from(NotificationEntity entity) {
        return new NotificationDto(
                entity.getId(),
                entity.getType(),
                entity.getTitle(),
                entity.getBody(),
                entity.getPayloadJson(),
                entity.getChannelStatus(),
                entity.getSentAt(),
                entity.getCreatedAt());
    }
}
