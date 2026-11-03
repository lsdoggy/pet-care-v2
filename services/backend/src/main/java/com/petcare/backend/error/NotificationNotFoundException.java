package com.petcare.backend.error;

public class NotificationNotFoundException extends RuntimeException {

    public NotificationNotFoundException(Long id) {
        super("Notification not found: " + id);
    }
}
