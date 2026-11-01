package com.petcare.backend.file;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.petcare.backend.error.InvalidFileException;

/**
 * Stores uploaded files under {app.upload.dir}/ and returns relative URLs served
 * by the Static Resource Handlers (WebConfig) at /files/uploads/... and /files/records/...
 */
@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    /** Sprint 4: vet record attachments may additionally be PDFs. */
    private static final Set<String> ALLOWED_ATTACHMENT_EXTENSIONS = Set.of("pdf", "jpg", "jpeg", "png", "webp");
    private static final long MAX_SIZE_BYTES = 5L * 1024 * 1024; // 5 MB (pet photos)
    private static final long MAX_ATTACHMENT_SIZE_BYTES = 10L * 1024 * 1024; // 10 MB (record attachments)

    private final Path rootDir;

    public FileStorageService(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.rootDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    /**
     * Saves image data and returns the public relative URL, e.g.
     * "/files/uploads/pets/3f2a...-ab12.jpg".
     */
    public String storePetPhoto(InputStream data, String originalFilename, long size) {
        if (size <= 0) {
            throw new InvalidFileException("Uploaded file is empty");
        }
        if (size > MAX_SIZE_BYTES) {
            throw new InvalidFileException("File too large. Max size is 5 MB");
        }
        String ext = extractExtension(originalFilename);
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(ext)) {
            throw new InvalidFileException("Unsupported file type '" + ext
                    + "'. Allowed: jpg, jpeg, png, webp");
        }
        try {
            Path petsDir = rootDir.resolve("pets");
            Files.createDirectories(petsDir);
            String filename = UUID.randomUUID() + "-" + Long.toHexString(System.nanoTime()) + "." + ext;
            Path target = petsDir.resolve(filename).normalize();
            if (!target.startsWith(petsDir)) {
                throw new InvalidFileException("Illegal file name");
            }
            Files.copy(data, target, StandardCopyOption.REPLACE_EXISTING);
            return "/files/uploads/pets/" + filename;
        } catch (IOException e) {
            throw new InvalidFileException("Failed to store file: " + e.getMessage());
        }
    }

    /**
     * Sprint 4: stores a record attachment (PDF or image) under {app.upload.dir}/records/
     * and returns the public URL served by WebConfig at /files/records/&lt;filename&gt;.
     */
    public StoredAttachment storeRecordAttachment(InputStream data, String originalFilename, long size) {
        if (size <= 0) {
            throw new InvalidFileException("Uploaded file is empty");
        }
        if (size > MAX_ATTACHMENT_SIZE_BYTES) {
            throw new InvalidFileException("File too large. Max size is 10 MB");
        }
        String ext = extractExtension(originalFilename);
        if (!ALLOWED_ATTACHMENT_EXTENSIONS.contains(ext)) {
            throw new InvalidFileException("Unsupported file type '" + ext
                    + "'. Allowed: pdf, jpg, jpeg, png, webp");
        }
        try {
            Path recordsDir = rootDir.resolve("records");
            Files.createDirectories(recordsDir);
            String filename = UUID.randomUUID() + "-" + Long.toHexString(System.nanoTime()) + "." + ext;
            Path target = recordsDir.resolve(filename).normalize();
            if (!target.startsWith(recordsDir)) {
                throw new InvalidFileException("Illegal file name");
            }
            Files.copy(data, target, StandardCopyOption.REPLACE_EXISTING);
            return new StoredAttachment("/files/records/" + filename, sanitizeName(originalFilename), ext, size);
        } catch (IOException e) {
            throw new InvalidFileException("Failed to store file: " + e.getMessage());
        }
    }

    /**
     * Best-effort removal of an attachment file from disk (used when a record is deleted).
     * Only files under {root}/records/ with generated UUID-style names can be removed;
     * any path traversal attempt is ignored.
     */
    public void deleteRecordAttachment(String url) {
        if (url == null || !url.startsWith("/files/records/")) {
            return;
        }
        String filename = url.substring("/files/records/".length());
        // Generated names are "<uuid>-<hex>.<ext>" — refuse anything else (no traversal).
        if (!filename.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9a-f]+\\.(pdf|jpg|jpeg|png|webp)$")) {
            return;
        }
        try {
            Path target = rootDir.resolve("records").resolve(filename).normalize();
            if (target.startsWith(rootDir.resolve("records"))) {
                Files.deleteIfExists(target);
            }
        } catch (IOException e) {
            // Non-fatal: DB row is already gone; leave an orphan file for manual cleanup.
            log.warn("Failed to delete attachment {}: {}", url, e.getMessage());
        }
    }

    /** Original user-visible file name, stripped of paths/control chars for safe storage in JSONB. */
    private static String sanitizeName(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return "attachment";
        }
        String base = Path.of(originalFilename).getFileName().toString();
        String cleaned = base.replaceAll("[\\p{Cntrl}\"'\\\\/]", "_");
        return cleaned.length() > 150 ? cleaned.substring(cleaned.length() - 150) : cleaned;
    }

    /** Metadata about a stored attachment, ready to be mapped into AttachmentDto. */
    public record StoredAttachment(String url, String name, String type, long size) {
    }

    private static String extractExtension(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return "";
        }
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
