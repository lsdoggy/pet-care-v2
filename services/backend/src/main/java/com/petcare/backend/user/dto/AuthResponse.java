package com.petcare.backend.user.dto;

public record AuthResponse(String accessToken, String tokenType, UserDto user) {

    public static AuthResponse of(String accessToken, UserDto user) {
        return new AuthResponse(accessToken, "Bearer", user);
    }
}
