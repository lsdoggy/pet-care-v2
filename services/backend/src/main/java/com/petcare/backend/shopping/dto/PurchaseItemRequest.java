package com.petcare.backend.shopping.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Body of POST /shopping-list/items/{id}/purchase.
 * {@code addStockQuantity} (optional, &gt; 0) restocks the linked product inside the same transaction.
 * Sending it for a custom item (no productId) is rejected with 400 — explicit, per approved plan.
 */
public record PurchaseItemRequest(
        @Min(value = 1, message = "addStockQuantity must be at least 1")
        @Max(value = 1000000, message = "addStockQuantity is too large")
        Integer addStockQuantity) {
}
