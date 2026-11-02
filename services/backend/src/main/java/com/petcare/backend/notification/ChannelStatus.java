package com.petcare.backend.notification;

/**
 * Delivery state of a notification row (V6 CHECK constraint keeps these four values).
 * pending -> sent | failed is set by the sender; read is set when the user opens the push.
 */
public enum ChannelStatus {
    PENDING("pending"),
    SENT("sent"),
    FAILED("failed"),
    READ("read");

    private final String value;

    ChannelStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static ChannelStatus fromValue(String raw) {
        for (ChannelStatus status : values()) {
            if (status.value.equalsIgnoreCase(raw)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown channel status: " + raw);
    }
}
