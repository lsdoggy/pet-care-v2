package com.petcare.backend.pet.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import com.petcare.backend.pet.PetEntity;
import com.petcare.backend.pet.PetSpecies;

public record PetDto(
        Long id,
        Long ownerId,
        String name,
        PetSpecies species,
        LocalDate birthDate,
        String photoUrl,
        Instant createdAt,
        Instant updatedAt,
        /** Design Sprint 3: optional breed (nullable, backward compatible). */
        String breed,
        /** Design Sprint 3: optional weight in kg (> 0 when set, nullable). */
        BigDecimal weightKg) {

    public static PetDto from(PetEntity entity) {
        return new PetDto(
                entity.getId(),
                entity.getOwnerId(),
                entity.getName(),
                entity.getSpecies(),
                entity.getBirthDate(),
                entity.getPhotoUrl(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getBreed(),
                entity.getWeightKg());
    }
}
