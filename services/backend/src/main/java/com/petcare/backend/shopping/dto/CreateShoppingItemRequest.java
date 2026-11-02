package com.petcare.backend.shopping.dto;

import com.petcare.backend.food.StockUnit;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * Two creation modes (MVP per sprint spec):
 * 1. Linked mode — provide {@code productId}; name/quantity/unit default from the product
 *    (explicit quantity/unit override the defaults). "Add to Shopping List" button uses this mode.
 * 2. Custom mode — omit {@code productId} and provide {@code customName}. Quick-add on mobile uses this mode.
 * The "at least one of productId / customName" rule is business logic enforced in ShoppingListService.
 */
public record CreateShoppingItemRequest(
        Long productId,

        @Size(min = 1, max = 150, message = "Name must be between 1 and 150 characters")
        String customName,

        @Min(value = 1, message = "Quantity must be at least 1")
        @Max(value = 999, message = "Quantity must be at most 999")
        Integer quantity,

        StockUnit unit) {

    public boolean isLinkedMode() {
        return productId != null;
    }
}
