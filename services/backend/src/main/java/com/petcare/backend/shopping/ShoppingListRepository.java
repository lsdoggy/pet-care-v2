package com.petcare.backend.shopping;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ShoppingListRepository extends JpaRepository<ShoppingListItemEntity, Long> {

    /** Checklist page listing: open items first (is_purchased ASC), oldest added first. */
    List<ShoppingListItemEntity> findByOwnerIdOrderByPurchasedAscCreatedAtAsc(Long ownerId);

    Optional<ShoppingListItemEntity> findByIdAndOwnerId(Long id, Long ownerId);

    /** Duplicate guard: an OPEN item for the same product must not be created twice. */
    List<ShoppingListItemEntity> findByOwnerIdAndProductIdAndPurchasedFalse(Long ownerId, Long productId);

    /** All items (open + purchased) referencing a product — used when the product is deleted. */
    List<ShoppingListItemEntity> findByProductId(Long productId);

    /** Case-insensitive exact-name lookup of open items (feeding-task linkage). */
    @Query("select i from ShoppingListItemEntity i where i.ownerId = :ownerId "
            + "and lower(i.customName) = lower(:name) and i.purchased = false")
    List<ShoppingListItemEntity> findOpenByNameIgnoreCase(@Param("ownerId") Long ownerId,
                                                          @Param("name") String name);
}
