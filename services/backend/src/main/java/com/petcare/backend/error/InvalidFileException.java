package com.petcare.backend.error;

public class InvalidFileException extends RuntimeException {

    public InvalidFileException(String message) {
        super(message);
    }
}
