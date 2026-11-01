package com.petcare.backend.task.dto;

import java.time.Instant;

import com.petcare.backend.task.CareTaskEntity;
import com.petcare.backend.task.CareTaskStatus;
import com.petcare.backend.task.CareTaskType;

public record CareTaskDto(
        Long id,
        Long petId,
        String petName,
        String title,
        CareTaskType type,
        /** UTC instant — clients convert to local time for display. */
        Instant dueAt,
        CareTaskStatus status,
        String recurrenceRule,
        Instant createdAt,
        Instant updatedAt) {

    public static CareTaskDto from(CareTaskEntity entity, String petName) {
        return new CareTaskDto(
                entity.getId(),
                entity.getPetId(),
                petName,
                entity.getTitle(),
                entity.getType(),
                entity.getDueAt(),
                entity.getStatus(),
                entity.getRecurrenceRule(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
