package com.petcare.backend.task.dto;

import java.time.Instant;

import com.petcare.backend.task.CareTaskType;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateTaskRequest(
        @NotNull(message = "Pet id is required")
        Long petId,

        @NotNull(message = "Title is required")
        @Size(min = 1, max = 150, message = "Title must be between 1 and 150 characters")
        String title,

        @NotNull(message = "Type is required")
        CareTaskType type,

        @NotNull(message = "Due date is required")
        @Future(message = "Due date must be in the future")
        Instant dueAt,

        /** Optional recurrence rule, e.g. "MONTHLY:1", "WEEKLY:2", "DAILY:3", "YEARLY:1". */
        @Size(max = 50, message = "Recurrence rule must be at most 50 characters")
        @Pattern(regexp = "^(DAILY|WEEKLY|MONTHLY|YEARLY):[1-9][0-9]{0,3}$",
                message = "Recurrence rule must look like MONTHLY:1, WEEKLY:2, DAILY:1 or YEARLY:1")
        String recurrenceRule) {
}
