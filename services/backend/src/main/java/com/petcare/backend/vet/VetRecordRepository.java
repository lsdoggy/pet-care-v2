package com.petcare.backend.vet;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VetRecordRepository extends JpaRepository<VetRecordEntity, Long> {

    /** "My records" — newest visit first. */
    List<VetRecordEntity> findByOwnerIdOrderByVisitDateDesc(Long ownerId);

    /** Per-pet chronology for the history endpoint. */
    List<VetRecordEntity> findByPetIdOrderByVisitDateDesc(Long petId);

    /** Records linked to an appointment (used when the appointment is deleted). */
    List<VetRecordEntity> findByAppointmentId(Long appointmentId);
}
