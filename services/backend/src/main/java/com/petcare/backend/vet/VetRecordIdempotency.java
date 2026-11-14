package com.petcare.backend.vet;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.function.Supplier;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.petcare.backend.error.IdempotencyException;
import com.petcare.backend.error.InvalidFileException;
import com.petcare.backend.vet.dto.RecordDto;

import tools.jackson.databind.json.JsonMapper;

@Component
class VetRecordIdempotency {

    enum Operation { CREATE, ATTACH }

    private final JdbcTemplate jdbc;
    private final JsonMapper json;

    VetRecordIdempotency(JdbcTemplate jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    // The caller's transaction holds this lock through both the mutation and response insert.
    void lockOwner(Long ownerId) {
        jdbc.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", Long.class, ownerId);
    }

    RecordDto execute(Long ownerId, Operation operation, String key, String fingerprint,
                      Supplier<RecordDto> mutation) {
        if (!key.matches("[!-~]{1,128}")) {
            throw new IdempotencyException(HttpStatus.BAD_REQUEST, "Invalid Idempotency-Key");
        }
        var previous = jdbc.query("""
                SELECT fingerprint, response FROM vet_record_idempotency
                WHERE owner_id = ? AND operation = ? AND request_key = ?
                """, (rs, row) -> new StoredResponse(rs.getString(1), rs.getString(2)),
                ownerId, operation.name(), key);
        if (!previous.isEmpty()) {
            StoredResponse stored = previous.getFirst();
            if (!stored.fingerprint().equals(fingerprint)) {
                throw new IdempotencyException(HttpStatus.CONFLICT,
                        "Idempotency-Key was already used with different content");
            }
            return json.readValue(stored.response(), RecordDto.class);
        }

        RecordDto response = mutation.get();
        jdbc.update("""
                INSERT INTO vet_record_idempotency (owner_id, operation, request_key, fingerprint, response)
                VALUES (?, ?, ?, ?, ?)
                """, ownerId, operation.name(), key, fingerprint, json.writeValueAsString(response));
        return response;
    }

    String fingerprint(Object metadata, InputStream content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(json.writeValueAsBytes(metadata));
            if (content != null) {
                digest.update((byte) 0);
                try (var sink = new DigestOutputStream(OutputStream.nullOutputStream(), digest)) {
                    content.transferTo(sink);
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException e) {
            throw new InvalidFileException("Failed to read uploaded file");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private record StoredResponse(String fingerprint, String response) {}
}
