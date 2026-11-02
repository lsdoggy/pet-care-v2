package com.petcare.backend.device.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * POST /api/v1/devices/register body. The mobile app sends the Expo push token
 * (or a raw FCM registration token) on every cold start while authenticated.
 */
public record RegisterDeviceRequest(
        @NotBlank(message = "Push token must not be empty")
        @Size(max = 512, message = "Push token must be at most 512 characters")
        String token,

        @NotBlank(message = "Platform must not be empty")
        @Pattern(regexp = "(?i)^(ios|android|web)$", message = "Platform must be one of: ios, android, web")
        String platform) {

    /** Normalized lowercase platform for DB storage (V7 CHECK constraint expects lowercase). */
    public String normalizedPlatform() {
        return platform.trim().toLowerCase();
    }
}
