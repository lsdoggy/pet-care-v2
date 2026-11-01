package com.petcare.backend.vet.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.petcare.backend.error.InvalidFileException;
import com.petcare.backend.vet.VetRecordEntity;

public record RecordDto(
        Long id,
        Long appointmentId,
        Long petId,
        String petName,
        LocalDate visitDate,
        String diagnosisText,
        String recommendationsText,
        String prescriptionsText,
        List<AttachmentDto> attachments,
        Instant createdAt,
        Instant updatedAt) {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<AttachmentDto>> ATTACHMENT_LIST = new TypeReference<>() {
    };

    public static RecordDto from(VetRecordEntity entity, String petName) {
        return new RecordDto(
                entity.getId(),
                entity.getAppointmentId(),
                entity.getPetId(),
                petName,
                entity.getVisitDate(),
                entity.getDiagnosisText(),
                entity.getRecommendationsText(),
                entity.getPrescriptionsText(),
                parseAttachments(entity.getAttachmentsJson()),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }

    /** Parses the JSONB payload back into DTOs; malformed data degrades to an empty list. */
    public static List<AttachmentDto> parseAttachments(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return MAPPER.readValue(json, ATTACHMENT_LIST);
        } catch (Exception e) {
            throw new InvalidFileException("Corrupted attachments payload on record: " + e.getMessage());
        }
    }

    public static String writeAttachments(List<AttachmentDto> attachments) {
        try {
            return MAPPER.writeValueAsString(attachments);
        } catch (Exception e) {
            throw new InvalidFileException("Failed to serialize attachments: " + e.getMessage());
        }
    }
}
