package com.petcare.backend.vet.dto;

import java.time.Instant;

/**
 * One event in the merged per-pet chronology returned by GET /api/v1/pets/{id}/history.
 * Exactly one of {@code appointment}/{@code record} is non-null.
 */
public record HistoryEventDto(
        Kind kind,
        /** Appointment: scheduledAt instant; Record: visitDate at start of day UTC. */
        Instant eventAt,
        AppointmentDto appointment,
        RecordDto record) {

    public enum Kind {
        APPOINTMENT,
        RECORD
    }
}
