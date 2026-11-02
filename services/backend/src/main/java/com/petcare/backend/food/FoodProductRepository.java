package com.petcare.backend.food;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FoodProductRepository extends JpaRepository<FoodProductEntity, Long> {

    /** "My stock" page listing. */
    List<FoodProductEntity> findByOwnerIdOrderByNameAsc(Long ownerId);

    Optional<FoodProductEntity> findByIdAndOwnerId(Long id, Long ownerId);

    /** Case-insensitive exact-name lookup used by the simplified feeding-task linkage. */
    @Query("select p from FoodProductEntity p where p.ownerId = :ownerId and lower(p.name) = lower(:name)")
    List<FoodProductEntity> findByOwnerAndNameIgnoreCase(@Param("ownerId") Long ownerId,
                                                         @Param("name") String name);
}
