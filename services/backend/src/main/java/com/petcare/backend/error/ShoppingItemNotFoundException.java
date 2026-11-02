package com.petcare.backend.error;

public class ShoppingItemNotFoundException extends RuntimeException {

    public ShoppingItemNotFoundException(Long id) {
        super("Shopping list item not found: " + id);
    }
}
