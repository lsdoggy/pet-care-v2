package com.petcare.backend.food;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FoodProductRepository extends JpaRepository<FoodProductEntity, Long> {

    /** "My stock" page listing. */
    List<FoodProductEntity> findByOwnerIdOrderByNameAsc(Long ownerId);

    Optional<FoodProductEntity> findByIdAndOwnerId(Long id, Long ownerId);

    /** Case-insensitive exact-name lookup used by the simplified feeding-task linkage. */
    List<FoodProductEntity> findByOwnerIdAndLowerName(Long ownerId, String lowerName);
}
