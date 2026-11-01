package com.petcare.backend.error;

public class InvalidRecurrenceRuleException extends RuntimeException {

    public InvalidRecurrenceRuleException(String rule) {
        super("Invalid recurrence rule: \"" + rule
                + "\". Expected format UNIT:INTERVAL, e.g. MONTHLY:1, WEEKLY:2, DAILY:1, YEARLY:1");
    }
}
