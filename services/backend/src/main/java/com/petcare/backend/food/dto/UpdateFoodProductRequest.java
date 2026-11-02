package com.petcare.backend.food.dto;

import com.petcare.backend.food.FoodCategory;
import com.petcare.backend.food.StockUnit;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * PATCH semantics: every field is optional; {@code null} means "keep current value".
 * ownerId is intentionally not updatable.
 */
public record UpdateFoodProductRequest(
        @Size(min = 1, max = 150, message = "Name must be between 1 and 150 characters")
        String name,

        @Size(max = 150, message = "Brand must be at most 150 characters")
        String brand,

        FoodCategory category,

        @Min(value = 1, message = "Package size must be positive")
        @Max(value = 1000000, message = "Package size is too large")
        Integer packageSizeGrams,

        @Min(value = 0, message = "Daily portion cannot be negative")
        @Max(value = 100000, message = "Daily portion is too large")
        Integer dailyPortionGrams,

        @Min(value = 0, message = "Stock quantity cannot be negative")
        @Max(value = 1000000, message = "Stock quantity is too large")
        Integer stockQuantity,

        @Min(value = 0, message = "Reorder threshold cannot be negative")
        @Max(value = 1000000, message = "Reorder threshold is too large")
        Integer reorderThreshold,

        StockUnit unit,

        @Size(max = 2000, message = "Notes must be at most 2000 characters")
        String notes) {
}
