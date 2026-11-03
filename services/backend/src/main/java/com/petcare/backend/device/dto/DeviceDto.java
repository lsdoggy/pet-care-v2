package com.petcare.backend.device.dto;

import java.time.Instant;

import com.petcare.backend.device.UserDeviceEntity;

/** Device row exposed to clients. The push token is truncated — full tokens never leave the server. */
public record DeviceDto(
        Long id,
        /** e.g. "ExponentPushToken[Abc…xyz]" (masked middle). */
        String tokenPreview,
        String platform,
        boolean pushEnabled,
        Instant createdAt,
        Instant lastSeenAt) {

    public static DeviceDto from(UserDeviceEntity entity) {
        return new DeviceDto(
                entity.getId(),
                mask(entity.getToken()),
                entity.getPlatform(),
                entity.isPushEnabled(),
                entity.getCreatedAt(),
                entity.getLastSeenAt());
    }

    private static String mask(String token) {
        if (token == null || token.length() <= 12) {
            return token;
        }
        return token.substring(0, 6) + "…" + token.substring(token.length() - 4);
    }
}
