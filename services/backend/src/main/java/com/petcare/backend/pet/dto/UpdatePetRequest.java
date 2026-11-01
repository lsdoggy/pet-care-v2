package com.petcare.backend.pet.dto;

import java.time.LocalDate;

import com.petcare.backend.pet.PetSpecies;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * PATCH semantics: every field is optional; {@code null} means "keep current value".
 * In this sprint birthDate can only be set or replaced, never unset.
 */
public record UpdatePetRequest(
        @Size(min = 1, max = 100, message = "Name must be between 1 and 100 characters")
        String name,

        PetSpecies species,

        LocalDate birthDate) {
}
