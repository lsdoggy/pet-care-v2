package com.petcare.backend.user.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Editable profile fields; blank values clear the optional field. */
public record UpdateProfileRequest(
        @Size(max = 80) String firstName,
        @Pattern(regexp = "^$|^\\+?[0-9 \\-()]{6,20}$", message = "Phone number format is invalid")
        @Size(max = 20) String phone) {
}
