package com.petcare.backend.error;

import java.time.LocalDate;

public class FutureBirthDateException extends RuntimeException {

    public FutureBirthDateException(LocalDate birthDate) {
        super("Birth date cannot be in the future: " + birthDate);
    }
}
