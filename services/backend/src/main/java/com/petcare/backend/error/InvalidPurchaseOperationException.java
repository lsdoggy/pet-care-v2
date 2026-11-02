package com.petcare.backend.error;

/**
 * Thrown when a purchase request is semantically invalid, e.g. asking to restock
 * a custom shopping item that is not linked to a catalog product. Mapped to 400.
 */
public class InvalidPurchaseOperationException extends RuntimeException {

    public InvalidPurchaseOperationException(String message) {
        super(message);
    }
}
