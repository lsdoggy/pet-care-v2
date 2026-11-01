package com.petcare.backend.error;

public class RecordNotFoundException extends RuntimeException {

    public RecordNotFoundException(Long id) {
        super("Veterinary record not found: " + id);
    }
}
