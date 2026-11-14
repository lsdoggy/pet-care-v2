package com.petcare.backend.error;

import org.springframework.http.HttpStatus;

public class IdempotencyException extends RuntimeException {

    private final HttpStatus status;

    public IdempotencyException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
