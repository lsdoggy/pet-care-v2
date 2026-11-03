package com.petcare.backend.error;

/** Design Sprint 3: raised when pet weight/breed fails service-level validation. */
public class InvalidPetWeightException extends RuntimeException {

    public InvalidPetWeightException(String message) {
        super(message);
    }
}
