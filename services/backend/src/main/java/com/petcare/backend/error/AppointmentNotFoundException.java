package com.petcare.backend.error;

public class AppointmentNotFoundException extends RuntimeException {

    public AppointmentNotFoundException(Long id) {
        super("Veterinary appointment not found: " + id);
    }
}
