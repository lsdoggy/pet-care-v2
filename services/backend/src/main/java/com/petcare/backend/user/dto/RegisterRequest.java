package com.petcare.backend.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Design Sprint 1: firstName/phone are optional additions — old clients that
 * omit them still deserialize fine (Jackson leaves them null), so the API
 * contract stays backward compatible.
 */
public record RegisterRequest(
        @NotBlank @Email @Size(max = 255) String email,
        @NotBlank @Size(min = 8, max = 72) String password,
        @Size(max = 80) String firstName,
        @Pattern(regexp = "^\\+?[0-9 \\-()]{6,20}$", message = "Phone number format is invalid")
        @Size(max = 20) String phone) {
}
