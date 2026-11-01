package com.petcare.backend.task;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CareTaskRepository extends JpaRepository<CareTaskEntity, Long> {

    /** Upcoming tasks of the current user: pending only, nearest first (uses idx_care_tasks_upcoming). */
    List<CareTaskEntity> findByOwnerIdAndStatusOrderByDueAtAsc(Long ownerId, CareTaskStatus status);

    List<CareTaskEntity> findByOwnerIdOrderByDueAtAsc(Long ownerId);

    boolean existsByPetIdAndStatus(Long petId, CareTaskStatus status);
}
