package com.petcare.backend.task;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "care_tasks")
public class CareTaskEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pet_id", nullable = false)
    private Long petId;

    /** Denormalized for fast "upcoming tasks" queries and ownership checks. */
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CareTaskType type;

    /** Due moment stored in UTC (Instant is timezone-agnostic). */
    @Column(name = "due_at", nullable = false)
    private Instant dueAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CareTaskStatus status = CareTaskStatus.PENDING;

    /** Optional recurrence rule, e.g. "MONTHLY:1", "WEEKLY:2", "DAILY:1", "YEARLY:1". */
    @Column(name = "recurrence_rule", length = 50)
    private String recurrenceRule;

    /** Sprint 6: set by the reminder scheduler so a task is notified only once. */
    @Column(name = "reminder_sent", nullable = false)
    private boolean reminderSent = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CareTaskEntity() {
    }

    public CareTaskEntity(Long petId, Long ownerId, String title, CareTaskType type,
                          Instant dueAt, String recurrenceRule) {
        this.petId = petId;
        this.ownerId = ownerId;
        this.title = title;
        this.type = type;
        this.dueAt = dueAt;
        this.recurrenceRule = recurrenceRule;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getPetId() {
        return petId;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public CareTaskType getType() {
        return type;
    }

    public void setType(CareTaskType type) {
        this.type = type;
    }

    public Instant getDueAt() {
        return dueAt;
    }

    public void setDueAt(Instant dueAt) {
        this.dueAt = dueAt;
    }

    public CareTaskStatus getStatus() {
        return status;
    }

    public void setStatus(CareTaskStatus status) {
        this.status = status;
    }

    public String getRecurrenceRule() {
        return recurrenceRule;
    }

    public void setRecurrenceRule(String recurrenceRule) {
        this.recurrenceRule = recurrenceRule;
    }

    public boolean isReminderSent() {
        return reminderSent;
    }

    public void setReminderSent(boolean reminderSent) {
        this.reminderSent = reminderSent;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
