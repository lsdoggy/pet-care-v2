package com.petcare.backend.user.dto;

import java.time.Instant;

import com.petcare.backend.user.UserEntity;

public record UserDto(
        Long id,
        String email,
        /** Design Sprint 1: optional display name collected at sign-up. */
        String firstName,
        /** Design Sprint 1: optional contact phone collected at sign-up. */
        String phone,
        /** Sprint 6: profile push switch (Push On/Off). */
        boolean pushNotificationsEnabled,
        /** Sprint 6: profile email switch (Email On/Off, opt-in). */
        boolean emailNotificationsEnabled,
        Instant createdAt) {

    public static UserDto from(UserEntity entity) {
        return new UserDto(
                entity.getId(),
                entity.getEmail(),
                entity.getFirstName(),
                entity.getPhone(),
                entity.isPushNotificationsEnabled(),
                entity.isEmailNotificationsEnabled(),
                entity.getCreatedAt());
    }
}
