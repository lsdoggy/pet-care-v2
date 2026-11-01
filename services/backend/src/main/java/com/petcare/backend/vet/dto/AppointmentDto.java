package com.petcare.backend.vet.dto;

import java.math.BigDecimal;
import java.time.Instant;

import com.petcare.backend.vet.AppointmentStatus;
import com.petcare.backend.vet.VetAppointmentEntity;

public record AppointmentDto(
        Long id,
        Long petId,
        String petName,
        String clinicName,
        String doctorName,
        /** UTC instant — clients convert to local time for display. */
        Instant scheduledAt,
        int durationMinutes,
        AppointmentStatus status,
        String address,
        BigDecimal cost,
        String currency,
        String notes,
        Instant createdAt,
        Instant updatedAt) {

    public static AppointmentDto from(VetAppointmentEntity entity, String petName) {
        return new AppointmentDto(
                entity.getId(),
                entity.getPetId(),
                petName,
                entity.getClinicName(),
                entity.getDoctorName(),
                entity.getScheduledAt(),
                entity.getDurationMinutes(),
                entity.getStatus(),
                entity.getAddress(),
                entity.getCost(),
                entity.getCurrency(),
                entity.getNotes(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
