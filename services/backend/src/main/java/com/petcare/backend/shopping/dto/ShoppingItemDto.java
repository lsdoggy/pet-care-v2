package com.petcare.backend.shopping.dto;

import java.time.Instant;

import com.petcare.backend.food.StockUnit;
import com.petcare.backend.shopping.ShoppingListItemEntity;

public record ShoppingItemDto(
        Long id,
        /** Null for custom one-off items. */
        Long productId,
        String customName,
        int quantity,
        StockUnit unit,
        boolean isPurchased,
        /** UTC instant, set when the item was marked purchased; null while open. */
        Instant purchasedAt,
        Instant createdAt,
        Instant updatedAt) {

    public static ShoppingItemDto from(ShoppingListItemEntity entity) {
        return new ShoppingItemDto(
                entity.getId(),
                entity.getProductId(),
                entity.getCustomName(),
                entity.getQuantity(),
                entity.getUnit(),
                entity.isPurchased(),
                entity.getPurchasedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
