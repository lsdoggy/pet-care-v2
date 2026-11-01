package com.petcare.backend.error;

public class PetNotFoundException extends RuntimeException {

    public PetNotFoundException(Long id) {
        super("Pet not found: " + id);
    }
}
