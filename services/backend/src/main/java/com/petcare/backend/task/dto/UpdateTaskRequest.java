package com.petcare.backend.task.dto;

import java.time.Instant;

import com.petcare.backend.task.CareTaskStatus;
import com.petcare.backend.task.CareTaskType;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * PATCH semantics: every field is optional; {@code null} means "keep current value".
 * Status may be flipped manually (e.g. reopen a task); completing with recurrence
 * should go through POST /tasks/{id}/complete instead.
 */
public record UpdateTaskRequest(
        @Size(min = 1, max = 150, message = "Title must be between 1 and 150 characters")
        String title,

        CareTaskType type,

        Instant dueAt,

        CareTaskStatus status,

        @Size(max = 50, message = "Recurrence rule must be at most 50 characters")
        @Pattern(regexp = "^(DAILY|WEEKLY|MONTHLY|YEARLY):[1-9][0-9]{0,3}$",
                message = "Recurrence rule must look like MONTHLY:1, WEEKLY:2, DAILY:1 or YEARLY:1")
        String recurrenceRule) {
}
