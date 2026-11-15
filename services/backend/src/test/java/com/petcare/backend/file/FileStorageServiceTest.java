package com.petcare.backend.file;

import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.petcare.backend.error.AccessDeniedForResourceException;

class FileStorageServiceTest {

    private static final String FILENAME = "01234567-89ab-4def-8123-456789abcdef-123.pdf";

    @TempDir
    Path root;

    @Test
    void rejectsNamesThatWereNotGeneratedByStorage() throws Exception {
        Path records = Files.createDirectory(root.resolve("records"));
        Files.writeString(records.resolve("123.pdf"), "attachment");
        var storage = new FileStorageService(root.toString());

        assertThrows(AccessDeniedForResourceException.class,
                () -> storage.loadRecordAttachment(FileStorageService.RECORD_ATTACHMENT_PREFIX + "123.pdf"));
    }

    @Test
    void rejectsSymbolicLinksInAttachmentStorage() throws Exception {
        Path storageRoot = Files.createDirectory(root.resolve("uploads"));
        Path outside = Files.createDirectory(root.resolve("outside"));
        Path file = Files.writeString(outside.resolve(FILENAME), "outside");
        Path records = Files.createDirectory(storageRoot.resolve("records"));
        Path linkedFile = Files.createSymbolicLink(records.resolve(FILENAME), file);
        var storage = new FileStorageService(storageRoot.toString());
        String url = FileStorageService.LEGACY_RECORD_ATTACHMENT_PREFIX + FILENAME;

        assertThrows(AccessDeniedForResourceException.class, () -> storage.loadRecordAttachment(url));

        Files.delete(linkedFile);
        Files.delete(records);
        Files.createSymbolicLink(records, outside);
        assertThrows(AccessDeniedForResourceException.class, () -> storage.loadRecordAttachment(url));
    }
}
