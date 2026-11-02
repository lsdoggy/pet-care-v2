package com.petcare.backend.shopping.dto;

import com.petcare.backend.food.StockUnit;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/** PATCH semantics: null = keep current value. productId/isPurchased are not updatable here. */
public record UpdateShoppingItemRequest(
        @Size(min = 1, max = 150, message = "Name must be between 1 and 150 characters")
        String customName,

        @Min(value = 1, message = "Quantity must be at least 1")
        @Max(value = 999, message = "Quantity must be at most 999")
        Integer quantity,

        StockUnit unit) {
}
