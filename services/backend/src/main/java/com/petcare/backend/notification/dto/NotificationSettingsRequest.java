package com.petcare.backend.notification.dto;

import jakarta.validation.constraints.NotNull;

/** PATCH /api/v1/users/notification-settings body (Sprint 6: profile Push/Email switches). */
public record NotificationSettingsRequest(
        @NotNull(message = "pushEnabled must be true or false")
        Boolean pushEnabled,

        @NotNull(message = "emailEnabled must be true or false")
        Boolean emailEnabled) {
}
