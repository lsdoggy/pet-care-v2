package com.petcare.backend.vet;

import com.petcare.backend.file.FileStorageService;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
class VetAttachmentController {
    private final VetService vetService;

    VetAttachmentController(VetService vetService) {
        this.vetService = vetService;
    }

    @GetMapping({FileStorageService.RECORD_ATTACHMENT_PREFIX + "{filename}",
            FileStorageService.LEGACY_RECORD_ATTACHMENT_PREFIX + "{filename}"})
    ResponseEntity<Resource> get(@PathVariable String filename, Authentication authentication) {
        Resource attachment = vetService.loadAttachment(filename, authentication.getName());
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaTypeFactory.getMediaType(attachment).orElseThrow())
                .body(attachment);
    }
}
