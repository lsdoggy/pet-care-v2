package com.petcare.backend.vet;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface VetRecordRepository extends JpaRepository<VetRecordEntity, Long> {

    @Query("""
            select r.attachmentsJson from VetRecordEntity r
            where r.ownerId = :ownerId and r.attachmentsJson like concat('%', :filename, '%')
            """)
    List<String> findAttachmentCandidates(Long ownerId, String filename);

    /** "My records" — newest visit first. */
    List<VetRecordEntity> findByOwnerIdOrderByVisitDateDesc(Long ownerId);

    /** Per-pet chronology for the history endpoint. */
    List<VetRecordEntity> findByPetIdOrderByVisitDateDesc(Long petId);

    /** Records linked to an appointment (used when the appointment is deleted). */
    List<VetRecordEntity> findByAppointmentId(Long appointmentId);
}
