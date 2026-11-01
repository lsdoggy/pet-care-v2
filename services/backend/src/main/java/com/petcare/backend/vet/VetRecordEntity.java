package com.petcare.backend.vet;

import java.time.Instant;
import java.time.LocalDate;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "veterinary_records")
public class VetRecordEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Optional link to a veterinary appointment (nullable FK). */
    @Column(name = "appointment_id")
    private Long appointmentId;

    @Column(name = "pet_id", nullable = false)
    private Long petId;

    /** Denormalized for ownership checks and per-user listings (same pattern as care_tasks). */
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "visit_date", nullable = false)
    private LocalDate visitDate;

    @Column(name = "diagnosis_text", columnDefinition = "text")
    private String diagnosisText;

    @Column(name = "recommendations_text", columnDefinition = "text")
    private String recommendationsText;

    @Column(name = "prescriptions_text", columnDefinition = "text")
    private String prescriptionsText;

    /**
     * Attachments stored as JSONB: [{"url":"/files/records/x.pdf","name":"x.pdf","type":"pdf","size":123}].
     * Mapped as a raw JSON string via Hibernate 7 native JSON support (no extra dependency).
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attachments_jsonb", nullable = false, columnDefinition = "jsonb")
    private String attachmentsJson = "[]";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected VetRecordEntity() {
    }

    public VetRecordEntity(Long appointmentId, Long petId, Long ownerId, LocalDate visitDate) {
        this.appointmentId = appointmentId;
        this.petId = petId;
        this.ownerId = ownerId;
        this.visitDate = visitDate;
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

    public Long getAppointmentId() {
        return appointmentId;
    }

    public void setAppointmentId(Long appointmentId) {
        this.appointmentId = appointmentId;
    }

    public Long getPetId() {
        return petId;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public LocalDate getVisitDate() {
        return visitDate;
    }

    public void setVisitDate(LocalDate visitDate) {
        this.visitDate = visitDate;
    }

    public String getDiagnosisText() {
        return diagnosisText;
    }

    public void setDiagnosisText(String diagnosisText) {
        this.diagnosisText = diagnosisText;
    }

    public String getRecommendationsText() {
        return recommendationsText;
    }

    public void setRecommendationsText(String recommendationsText) {
        this.recommendationsText = recommendationsText;
    }

    public String getPrescriptionsText() {
        return prescriptionsText;
    }

    public void setPrescriptionsText(String prescriptionsText) {
        this.prescriptionsText = prescriptionsText;
    }

    public String getAttachmentsJson() {
        return attachmentsJson;
    }

    public void setAttachmentsJson(String attachmentsJson) {
        this.attachmentsJson = attachmentsJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
