package com.petcare.backend.pet.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.petcare.backend.pet.PetSpecies;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

/**
 * PATCH semantics: every field is optional; {@code null} means "keep current value".
 * In this sprint birthDate can only be set or replaced, never unset.
 */
public record UpdatePetRequest(
        @Size(min = 1, max = 100, message = "Name must be between 1 and 100 characters")
        String name,

        PetSpecies species,

        LocalDate birthDate,

        /** Design Sprint 3: optional breed (PATCH semantics: null = keep). */
        @Size(max = 80, message = "Breed must be at most 80 characters")
        String breed,

        /** Design Sprint 3: optional weight in kg (PATCH semantics: null = keep). */
        @DecimalMin(value = "0.0", inclusive = false, message = "Weight must be greater than 0")
        @DecimalMax(value = "200.0", message = "Weight must be at most 200 kg")
        BigDecimal weightKg) {
}
