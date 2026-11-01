package com.petcare.backend.user.dto;

import java.time.Instant;

import com.petcare.backend.user.UserEntity;

public record UserDto(Long id, String email, Instant createdAt) {

    public static UserDto from(UserEntity entity) {
        return new UserDto(entity.getId(), entity.getEmail(), entity.getCreatedAt());
    }
}
