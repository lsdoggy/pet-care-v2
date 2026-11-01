package com.petcare.backend.pet.dto;

import java.time.LocalDate;

import com.petcare.backend.pet.PetSpecies;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreatePetRequest(
        @NotNull(message = "Name is required")
        @Size(min = 1, max = 100, message = "Name must be between 1 and 100 characters")
        String name,

        @NotNull(message = "Species is required")
        PetSpecies species,

        LocalDate birthDate) {
}
