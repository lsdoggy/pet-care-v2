package com.petcare.backend.pet;

import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
class PetPhotoController {

    private final PetService petService;

    PetPhotoController(PetService petService) {
        this.petService = petService;
    }

    @GetMapping({"/files/uploads/pets/{filename}", "/files/pets/{filename}"})
    ResponseEntity<Resource> get(@PathVariable String filename, Authentication authentication) {
        Resource photo = petService.loadPhoto(filename, authentication.getName());
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaTypeFactory.getMediaType(photo).orElseThrow())
                .body(photo);
    }
}
