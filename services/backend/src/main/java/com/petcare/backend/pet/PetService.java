package com.petcare.backend.pet;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.error.AccessDeniedForResourceException;
import com.petcare.backend.error.FutureBirthDateException;
import com.petcare.backend.error.InvalidPetWeightException;
import com.petcare.backend.error.PetNotFoundException;
import com.petcare.backend.file.FileStorageService;
import com.petcare.backend.pet.dto.CreatePetRequest;
import com.petcare.backend.pet.dto.PetDto;
import com.petcare.backend.pet.dto.UpdatePetRequest;
import com.petcare.backend.user.UserRepository;
import com.petcare.backend.user.UserEntity;

@Service
public class PetService {

    private final PetRepository petRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    public PetService(PetRepository petRepository,
                      UserRepository userRepository,
                      FileStorageService fileStorageService) {
        this.petRepository = petRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional(readOnly = true)
    public List<PetDto> listMyPets(String email) {
        UserEntity user = resolveUser(email);
        return petRepository.findByOwnerIdAndDeletedFalseOrderByCreatedAtAsc(user.getId())
                .stream()
                .map(PetDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PetDto getPet(Long id, String email) {
        return PetDto.from(loadOwnedPet(id, email));
    }

    @Transactional
    public PetDto createPet(CreatePetRequest request, String email) {
        UserEntity user = resolveUser(email);
        validateBirthDate(request.birthDate());
        PetEntity pet = new PetEntity(user.getId(), request.name().trim(), request.species(), request.birthDate());
        pet.setBreed(normalizeBreed(request.breed()));
        pet.setWeightKg(request.weightKg());
        return PetDto.from(petRepository.save(pet));
    }

    @Transactional
    public PetDto updatePet(Long id, UpdatePetRequest request, String email) {
        PetEntity pet = loadOwnedPet(id, email);
        if (request.name() != null && !request.name().isBlank()) {
            pet.setName(request.name().trim());
        }
        if (request.species() != null) {
            pet.setSpecies(request.species());
        }
        if (request.birthDate() != null) {
            validateBirthDate(request.birthDate());
            pet.setBirthDate(request.birthDate());
        }
        // PATCH semantics: null = keep current value; empty string = clear breed.
        if (request.breed() != null) {
            pet.setBreed(normalizeBreed(request.breed()));
        }
        if (request.weightKg() != null) {
            validateWeight(request.weightKg());
            pet.setWeightKg(request.weightKg());
        }
        return PetDto.from(pet);
    }

    /** Soft delete: sets deleted = true. Row stays in DB for future audit features. */
    @Transactional
    public void deletePet(Long id, String email) {
        PetEntity pet = loadOwnedPet(id, email);
        pet.setDeleted(true);
    }

    @Transactional
    public PetDto attachPhoto(Long id, InputStream data, String originalFilename, long size, String email) {
        PetEntity pet = loadOwnedPet(id, email);
        pet.setPhotoUrl(fileStorageService.storePetPhoto(data, originalFilename, size));
        return PetDto.from(pet);
    }

    @Transactional(readOnly = true)
    public Resource loadPhoto(String filename, String email) {
        Long ownerId = resolveUser(email).getId();
        if (!petRepository.existsByOwnerIdAndDeletedFalseAndPhotoUrlIn(ownerId,
                List.of("/files/uploads/pets/" + filename, "/files/pets/" + filename))) {
            throw new AccessDeniedForResourceException("Photo not found");
        }
        return fileStorageService.loadPetPhoto(filename);
    }

    private PetEntity loadOwnedPet(Long id, String email) {
        UserEntity user = resolveUser(email);
        PetEntity pet = petRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new PetNotFoundException(id));
        if (!pet.getOwnerId().equals(user.getId())) {
            // Do not leak existence of other users' pets.
            throw new AccessDeniedForResourceException("Pet not found: " + id);
        }
        return pet;
    }

    private UserEntity resolveUser(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new AccessDeniedForResourceException("User not found"));
    }

    private static void validateBirthDate(LocalDate birthDate) {
        if (birthDate != null && birthDate.isAfter(LocalDate.now())) {
            throw new FutureBirthDateException(birthDate);
        }
    }

    /** Design Sprint 3: trim breed; blank string becomes null (no empty strings in DB). */
    private static String normalizeBreed(String breed) {
        if (breed == null || breed.isBlank()) {
            return null;
        }
        String trimmed = breed.trim();
        if (trimmed.length() > 80) {
            throw new InvalidPetWeightException("Breed must be at most 80 characters");
        }
        return trimmed;
    }

    /** Design Sprint 3: server-side guard mirroring bean validation (weight must be > 0, <= 200). */
    private static void validateWeight(BigDecimal weightKg) {
        if (weightKg.signum() <= 0 || weightKg.compareTo(new BigDecimal("200")) > 0) {
            throw new InvalidPetWeightException("Weight must be greater than 0 and at most 200 kg");
        }
    }
}
