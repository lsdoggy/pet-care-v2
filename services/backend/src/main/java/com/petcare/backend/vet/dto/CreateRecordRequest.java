package com.petcare.backend.vet.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

public record CreateRecordRequest(
        @NotNull(message = "Pet id is required")
        Long petId,

        /** Optional link to an existing appointment of the same owner & pet. */
        Long appointmentId,

        @NotNull(message = "Visit date is required")
        @PastOrPresent(message = "Visit date cannot be in the future")
        LocalDate visitDate,

        @Size(max = 4000, message = "Diagnosis must be at most 4000 characters")
        String diagnosisText,

        @Size(max = 4000, message = "Recommendations must be at most 4000 characters")
        String recommendationsText,

        @Size(max = 4000, message = "Prescriptions must be at most 4000 characters")
        String prescriptionsText) {
}
