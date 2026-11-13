package com.petcare.backend.notification;


/** Delivery channel of a notification (stored lowercase in the DB, see V6 migration). */
public enum NotificationType {
    PUSH("push"),
    EMAIL("email");

    private final String value;

    NotificationType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static NotificationType fromValue(String raw) {
        for (NotificationType type : values()) {
            if (type.value.equalsIgnoreCase(raw)) {
                return type;
            }
        }
        throw new IllegalArgumentException("Unknown notification type: " + raw);
    }
}
