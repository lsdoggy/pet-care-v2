package com.petcare.backend.vet;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.petcare.backend.vet.dto.CreateClinicAppointmentRequest;

import jakarta.validation.Valid;

@RestController
class ClinicVetInfoController {

    private final VetService vetService;
    private final long petId;
    private final String clinicName;

    ClinicVetInfoController(VetService vetService,
                            @Value("${petcare.vetinfo.pet-id:${PETCARE_VETINFO_PET_ID:0}}") long petId,
                            @Value("${petcare.vetinfo.clinic-name:${PETCARE_VETINFO_CLINIC_NAME:}}") String clinicName) {
        this.vetService = vetService;
        this.petId = petId;
        this.clinicName = clinicName.trim();
    }

    @PostMapping(path = "/api/v1/vetinfo", consumes = "application/json")
    @ResponseStatus(HttpStatus.CREATED)
    Map<String, Long> createAppointment(@Valid @RequestBody CreateClinicAppointmentRequest request) {
        if (petId <= 0 || clinicName.isEmpty() || clinicName.length() > 150) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
        }
        return Map.of("appointmentId", vetService.createClinicAppointment(petId, clinicName, request));
    }
}
