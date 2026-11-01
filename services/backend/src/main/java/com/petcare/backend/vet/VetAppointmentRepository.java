package com.petcare.backend.vet;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface VetAppointmentRepository extends JpaRepository<VetAppointmentEntity, Long> {

    /** "My appointments" — soonest first. */
    List<VetAppointmentEntity> findByOwnerIdOrderByScheduledAtAsc(Long ownerId);

    /** Per-pet chronology for the history endpoint. */
    List<VetAppointmentEntity> findByPetIdOrderByScheduledAtDesc(Long petId);
}
