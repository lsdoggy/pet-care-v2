package com.petcare.backend.vet;

/** Lifecycle of a veterinary appointment (stored as VARCHAR uppercase, like CareTaskStatus). */
public enum AppointmentStatus {
    SCHEDULED,
    COMPLETED,
    CANCELLED
}
