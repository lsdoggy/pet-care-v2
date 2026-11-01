package com.petcare.backend.file;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.petcare.backend.error.InvalidFileException;

/**
 * Stores uploaded files under {app.upload.dir}/pets/ and returns a relative URL
 * served by the Static Resource Handler at /files/uploads/...
 */
@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final long MAX_SIZE_BYTES = 5L * 1024 * 1024; // 5 MB

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
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
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
