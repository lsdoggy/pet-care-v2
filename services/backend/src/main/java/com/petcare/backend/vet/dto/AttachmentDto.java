package com.petcare.backend.vet.dto;

/** A single file attached to a veterinary record (stored inside attachments_jsonb). */
public record AttachmentDto(
        /** Public URL served by Spring, e.g. /files/records/<uuid>.pdf */
        String url,
        /** Original file name as uploaded by the client. */
        String name,
        /** Extension without dot: pdf | jpg | jpeg | png | webp */
        String type,
        /** Size in bytes. */
        long size) {
}
