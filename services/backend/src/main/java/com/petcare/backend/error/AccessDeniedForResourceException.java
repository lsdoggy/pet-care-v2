package com.petcare.backend.error;

/**
 * Thrown when the authenticated user tries to touch a pet they do not own
 * (or a soft-deleted pet). Mapped to 404 so we do not leak resource existence.
 */
public class AccessDeniedForResourceException extends RuntimeException {

    public AccessDeniedForResourceException(String message) {
        super(message);
    }
}
