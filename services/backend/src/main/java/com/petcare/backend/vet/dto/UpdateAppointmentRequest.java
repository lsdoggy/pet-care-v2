package com.petcare.backend.vet.dto;

import java.math.BigDecimal;
import java.time.Instant;

import com.petcare.backend.vet.AppointmentStatus;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * PATCH semantics: every field is optional; {@code null} means "keep current value".
 * petId is intentionally NOT updatable — an appointment belongs to the pet it was booked for.
 */
public record UpdateAppointmentRequest(
        @Size(min = 1, max = 150, message = "Clinic name must be between 1 and 150 characters")
        String clinicName,

        @Size(max = 150, message = "Doctor name must be at most 150 characters")
        String doctorName,

        Instant scheduledAt,

        @Min(value = 5, message = "Duration must be at least 5 minutes")
        @Max(value = 480, message = "Duration must be at most 480 minutes")
        Integer durationMinutes,

        AppointmentStatus status,

        @Size(max = 255, message = "Address must be at most 255 characters")
        String address,

        @DecimalMin(value = "0", message = "Cost cannot be negative")
        @DecimalMax(value = "99999999.99", message = "Cost is too large")
        BigDecimal cost,

        @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter ISO-4217 code, e.g. USD")
        String currency,

        @Size(max = 2000, message = "Notes must be at most 2000 characters")
        String notes) {
}
