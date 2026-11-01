package com.petcare.backend.vet.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

/**
 * PATCH semantics: every field is optional; {@code null} means "keep current value".
 * petId/appointmentId are not updatable — use DELETE + POST to re-link a record.
 */
public record UpdateRecordRequest(
        @PastOrPresent(message = "Visit date cannot be in the future")
        LocalDate visitDate,

        @Size(max = 4000, message = "Diagnosis must be at most 4000 characters")
        String diagnosisText,

        @Size(max = 4000, message = "Recommendations must be at most 4000 characters")
        String recommendationsText,

        @Size(max = 4000, message = "Prescriptions must be at most 4000 characters")
        String prescriptionsText) {
}
