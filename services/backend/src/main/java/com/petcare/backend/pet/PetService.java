package com.petcare.backend.pet;

import java.io.InputStream;
import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.error.AccessDeniedForResourceException;
import com.petcare.backend.error.FutureBirthDateException;
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
}
