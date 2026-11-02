package com.petcare.backend.food.dto;

import java.time.Instant;

import com.petcare.backend.food.FoodCategory;
import com.petcare.backend.food.FoodProductEntity;
import com.petcare.backend.food.StockUnit;

public record FoodProductDto(
        Long id,
        String name,
        String brand,
        FoodCategory category,
        Integer packageSizeGrams,
        Integer dailyPortionGrams,
        int stockQuantity,
        int reorderThreshold,
        StockUnit unit,
        String notes,
        /** True when stock_quantity <= reorder_threshold (drives the progress bar / suggestions). */
        boolean lowStock,
        Instant createdAt,
        Instant updatedAt) {

    public static FoodProductDto from(FoodProductEntity entity) {
        return new FoodProductDto(
                entity.getId(),
                entity.getName(),
                entity.getBrand(),
                entity.getCategory(),
                entity.getPackageSizeGrams(),
                entity.getDailyPortionGrams(),
                entity.getStockQuantity(),
                entity.getReorderThreshold(),
                entity.getUnit(),
                entity.getNotes(),
                entity.isLowStock(),
                entity.getCreatedAt(),
                entity.getUpdatedAt());
    }
}
