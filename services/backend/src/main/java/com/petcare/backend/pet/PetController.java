package com.petcare.backend.pet;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.petcare.backend.error.InvalidFileException;
import com.petcare.backend.pet.dto.CreatePetRequest;
import com.petcare.backend.pet.dto.PetDto;
import com.petcare.backend.pet.dto.UpdatePetRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/pets")
public class PetController {

    private final PetService petService;

    public PetController(PetService petService) {
        this.petService = petService;
    }

    /** Returns pets of the currently authenticated user only. */
    @GetMapping
    List<PetDto> list(Authentication authentication) {
        return petService.listMyPets(authentication.getName());
    }

    @GetMapping("/{id}")
    PetDto get(@PathVariable Long id, Authentication authentication) {
        return petService.getPet(id, authentication.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    PetDto create(@Valid @RequestBody CreatePetRequest request, Authentication authentication) {
        return petService.createPet(request, authentication.getName());
    }

    @PatchMapping("/{id}")
    PetDto update(@PathVariable Long id,
                  @Valid @RequestBody UpdatePetRequest request,
                  Authentication authentication) {
        return petService.updatePet(id, request, authentication.getName());
    }

    /** Soft delete — row remains in DB with deleted = true. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable Long id, Authentication authentication) {
        petService.deletePet(id, authentication.getName());
    }

    @PostMapping("/{id}/photo")
    PetDto uploadPhoto(@PathVariable Long id,
                       @RequestParam("file") MultipartFile file,
                       Authentication authentication) {
        if (file.isEmpty()) {
            throw new InvalidFileException("Uploaded file is empty");
        }
        try (var in = file.getInputStream()) {
            return petService.attachPhoto(id, in, file.getOriginalFilename(), file.getSize(),
                    authentication.getName());
        } catch (IOException e) {
            throw new InvalidFileException("Failed to read uploaded file: " + e.getMessage());
        }
    }
}
