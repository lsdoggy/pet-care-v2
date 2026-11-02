package com.petcare.backend.error;

public class FoodProductNotFoundException extends RuntimeException {

    public FoodProductNotFoundException(Long id) {
        super("Food product not found: " + id);
    }
}
