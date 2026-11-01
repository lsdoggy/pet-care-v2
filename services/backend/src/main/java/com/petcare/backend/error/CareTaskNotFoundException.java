package com.petcare.backend.error;

public class CareTaskNotFoundException extends RuntimeException {

    public CareTaskNotFoundException(Long id) {
        super("Care task not found: " + id);
    }
}
