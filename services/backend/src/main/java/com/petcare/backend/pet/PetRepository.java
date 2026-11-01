package com.petcare.backend.pet;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PetRepository extends JpaRepository<PetEntity, Long> {

    List<PetEntity> findByOwnerIdAndDeletedFalseOrderByCreatedAtAsc(Long ownerId);

    Optional<PetEntity> findByIdAndDeletedFalse(Long id);
}
