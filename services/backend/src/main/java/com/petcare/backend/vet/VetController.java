package com.petcare.backend.vet;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.petcare.backend.error.InvalidFileException;
import com.petcare.backend.vet.dto.AppointmentDto;
import com.petcare.backend.vet.dto.CreateAppointmentRequest;
import com.petcare.backend.vet.dto.CreateRecordRequest;
import com.petcare.backend.vet.dto.HistoryEventDto;
import com.petcare.backend.vet.dto.RecordDto;
import com.petcare.backend.vet.dto.UpdateAppointmentRequest;
import com.petcare.backend.vet.dto.UpdateRecordRequest;

import jakarta.validation.Valid;

/**
 * Sprint 4: Veterinary Appointments & Records CRUD.
 * Layering: Controller -> {@link VetService} -> Repositories; no business logic here.
 */
@RestController
@RequestMapping("/api/v1")
public class VetController {

    private final VetService vetService;

    public VetController(VetService vetService) {
        this.vetService = vetService;
    }

    /* ---------- Appointments ---------- */

    /** All appointments of the currently authenticated user, soonest first. */
    @GetMapping("/appointments")
    List<AppointmentDto> listAppointments(Authentication authentication) {
        return vetService.listMyAppointments(authentication.getName());
    }

    @GetMapping("/appointments/{id}")
    AppointmentDto getAppointment(@PathVariable Long id, Authentication authentication) {
        return vetService.getAppointment(id, authentication.getName());
    }

    @PostMapping("/appointments")
    @ResponseStatus(HttpStatus.CREATED)
    AppointmentDto createAppointment(@Valid @RequestBody CreateAppointmentRequest request,
                                     Authentication authentication) {
        return vetService.createAppointment(request, authentication.getName());
    }

    @PatchMapping("/appointments/{id}")
    AppointmentDto updateAppointment(@PathVariable Long id,
                                     @Valid @RequestBody UpdateAppointmentRequest request,
                                     Authentication authentication) {
        return vetService.updateAppointment(id, request, authentication.getName());
    }

    /** Hard delete; linked records are kept but unlinked. */
    @DeleteMapping("/appointments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteAppointment(@PathVariable Long id, Authentication authentication) {
        vetService.deleteAppointment(id, authentication.getName());
    }

    /* ---------- Records ---------- */

    /** All records of the currently authenticated user, newest visit first. */
    @GetMapping("/records")
    List<RecordDto> listRecords(Authentication authentication) {
        return vetService.listMyRecords(authentication.getName());
    }

    @GetMapping("/records/{id}")
    RecordDto getRecord(@PathVariable Long id, Authentication authentication) {
        return vetService.getRecord(id, authentication.getName());
    }

    @PostMapping("/records")
    @ResponseStatus(HttpStatus.CREATED)
    RecordDto createRecord(@Valid @RequestBody CreateRecordRequest request,
                           Authentication authentication) {
        return vetService.createRecord(request, authentication.getName());
    }

    @PatchMapping("/records/{id}")
    RecordDto updateRecord(@PathVariable Long id,
                           @Valid @RequestBody UpdateRecordRequest request,
                           Authentication authentication) {
        return vetService.updateRecord(id, request, authentication.getName());
    }

    /** Deletes the record and its attachment files from disk. */
    @DeleteMapping("/records/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteRecord(@PathVariable Long id, Authentication authentication) {
        vetService.deleteRecord(id, authentication.getName());
    }

    /** Attaches a PDF/image (photo of a document etc.) to an existing record. */
    @PostMapping("/records/{id}/attachments")
    RecordDto addAttachment(@PathVariable Long id,
                            @RequestParam("file") MultipartFile file,
                            Authentication authentication) {
        if (file.isEmpty()) {
            throw new InvalidFileException("Uploaded file is empty");
        }
        try (var in = file.getInputStream()) {
            return vetService.addRecordAttachment(id, in, file.getOriginalFilename(),
                    file.getSize(), authentication.getName());
        } catch (IOException e) {
            throw new InvalidFileException("Failed to read uploaded file: " + e.getMessage());
        }
    }

    /* ---------- Merged per-pet chronology ---------- */

    /** Combined timeline (appointments + records) for one pet, newest event first. */
    @GetMapping("/pets/{petId}/history")
    List<HistoryEventDto> history(@PathVariable Long petId, Authentication authentication) {
        return vetService.getPetHistory(petId, authentication.getName());
    }
}
