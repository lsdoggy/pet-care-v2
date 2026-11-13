package com.petcare.backend.task;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CareTaskRepository extends JpaRepository<CareTaskEntity, Long> {

    /** Upcoming tasks of the current user: pending only, nearest first (uses idx_care_tasks_upcoming). */
    List<CareTaskEntity> findByOwnerIdAndStatusOrderByDueAtAsc(Long ownerId, CareTaskStatus status);

    List<CareTaskEntity> findByOwnerIdOrderByDueAtAsc(Long ownerId);

    boolean existsByPetIdAndStatus(Long petId, CareTaskStatus status);

    /**
     * Sprint 6 scheduler scan: pending, not-yet-reminded tasks due within [from, to].
     * Uses the partial index idx_care_tasks_due_reminder (V8 migration).
     */
    List<CareTaskEntity> findByStatusAndReminderSentFalseAndDueAtBetweenOrderByDueAtAsc(
            CareTaskStatus status, Instant from, Instant to);

    List<CareTaskEntity> findByStatusAndDayReminderSentFalseAndDueAtGreaterThanAndDueAtLessThanEqual(
            CareTaskStatus status, Instant from, Instant to);

    List<CareTaskEntity> findByStatusAndOverdueReminderSentFalseAndDueAtLessThanEqual(
            CareTaskStatus status, Instant to);
}
