package com.petcare.backend.vet;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.error.AccessDeniedForResourceException;
import com.petcare.backend.error.AppointmentNotFoundException;
import com.petcare.backend.error.PetNotFoundException;
import com.petcare.backend.error.RecordNotFoundException;
import com.petcare.backend.file.FileStorageService;
import com.petcare.backend.pet.PetEntity;
import com.petcare.backend.pet.PetRepository;
import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;
import com.petcare.backend.vet.dto.AppointmentDto;
import com.petcare.backend.vet.dto.AttachmentDto;
import com.petcare.backend.vet.dto.CreateAppointmentRequest;
import com.petcare.backend.vet.dto.CreateClinicAppointmentRequest;
import com.petcare.backend.vet.dto.CreateRecordRequest;
import com.petcare.backend.vet.dto.HistoryEventDto;
import com.petcare.backend.vet.dto.RecordDto;
import com.petcare.backend.vet.dto.UpdateAppointmentRequest;
import com.petcare.backend.vet.dto.UpdateRecordRequest;

/**
 * Sprint 4 business logic: veterinary appointments, medical records and the merged
 * per-pet chronology. Ownership model mirrors CareTaskService (denormalized owner_id).
 */
@Service
public class VetService {

    private final VetAppointmentRepository appointmentRepository;
    private final VetRecordRepository recordRepository;
    private final PetRepository petRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    public VetService(VetAppointmentRepository appointmentRepository,
                      VetRecordRepository recordRepository,
                      PetRepository petRepository,
                      UserRepository userRepository,
                      FileStorageService fileStorageService) {
        this.appointmentRepository = appointmentRepository;
        this.recordRepository = recordRepository;
        this.petRepository = petRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
    }

    /* ---------- Appointments ---------- */

    @Transactional(readOnly = true)
    public List<AppointmentDto> listMyAppointments(String email) {
        UserEntity user = resolveUser(email);
        return toAppointmentDtoList(appointmentRepository.findByOwnerIdOrderByScheduledAtAsc(user.getId()));
    }

    @Transactional(readOnly = true)
    public AppointmentDto getAppointment(Long id, String email) {
        return toAppointmentDto(loadOwnedAppointment(id, email));
    }

    @Transactional
    public AppointmentDto createAppointment(CreateAppointmentRequest request, String email) {
        UserEntity user = resolveUser(email);
        PetEntity pet = loadOwnedPet(request.petId(), user.getId());
        return saveAppointment(request, pet, user.getId());
    }

    @Transactional
    public Long createClinicAppointment(Long petId, String clinicName, CreateClinicAppointmentRequest request) {
        PetEntity pet = petRepository.findByIdAndDeletedFalse(petId)
                .orElseThrow(() -> new PetNotFoundException(petId));
        var appointment = new CreateAppointmentRequest(petId, clinicName, request.doctorName(),
                request.scheduledAt(), request.durationMinutes(), AppointmentStatus.SCHEDULED,
                request.address(), request.cost(), request.currency(), request.notes(), request.reason());
        return saveAppointment(appointment, pet, pet.getOwnerId()).id();
    }

    private AppointmentDto saveAppointment(CreateAppointmentRequest request, PetEntity pet, Long ownerId) {
        VetAppointmentEntity appointment = new VetAppointmentEntity(
                pet.getId(),
                ownerId,
                request.clinicName().trim(),
                request.scheduledAt());
        applyAppointmentFields(appointment, request.doctorName(), request.durationMinutes(),
                request.status(), request.address(), request.cost(), request.currency(), request.notes());
        appointment.setReason(blankToNull(request.reason()));
        return toAppointmentDto(appointmentRepository.save(appointment));
    }

    /** PATCH semantics: null fields keep their current values. */
    @Transactional
    public AppointmentDto updateAppointment(Long id, UpdateAppointmentRequest request, String email) {
        VetAppointmentEntity appointment = loadOwnedAppointment(id, email);
        if (request.clinicName() != null && !request.clinicName().isBlank()) {
            appointment.setClinicName(request.clinicName().trim());
        }
        if (request.doctorName() != null) {
            appointment.setDoctorName(blankToNull(request.doctorName()));
        }
        if (request.scheduledAt() != null) {
            appointment.setScheduledAt(request.scheduledAt());
        }
        if (request.durationMinutes() != null) {
            appointment.setDurationMinutes(request.durationMinutes());
        }
        if (request.status() != null) {
            appointment.setStatus(request.status());
        }
        if (request.address() != null) {
            appointment.setAddress(blankToNull(request.address()));
        }
        if (request.cost() != null) {
            appointment.setCost(request.cost());
        }
        if (request.currency() != null) {
            appointment.setCurrency(request.currency().toUpperCase());
        }
        if (request.notes() != null) {
            appointment.setNotes(blankToNull(request.notes()));
        }
        if (request.reason() != null) {
            appointment.setReason(blankToNull(request.reason()));
        }
        return toAppointmentDto(appointment);
    }

    /**
     * Hard delete of an appointment. Records that referenced it are kept but unlinked
     * (appointment_id -> null), so medical history is never lost with the booking.
     */
    @Transactional
    public void deleteAppointment(Long id, String email) {
        loadOwnedAppointment(id, email);
        for (VetRecordEntity record : recordRepository.findByAppointmentId(id)) {
            record.setAppointmentId(null);
        }
        appointmentRepository.deleteById(id);
    }

    /* ---------- Records ---------- */

    @Transactional(readOnly = true)
    public List<RecordDto> listMyRecords(String email) {
        UserEntity user = resolveUser(email);
        return toRecordDtoList(recordRepository.findByOwnerIdOrderByVisitDateDesc(user.getId()));
    }

    @Transactional(readOnly = true)
    public RecordDto getRecord(Long id, String email) {
        return toRecordDto(loadOwnedRecord(id, email));
    }

    @Transactional
    public RecordDto createRecord(CreateRecordRequest request, String email) {
        UserEntity user = resolveUser(email);
        PetEntity pet = loadOwnedPet(request.petId(), user.getId());
        Long appointmentId = request.appointmentId();
        if (appointmentId != null) {
            // Optional link: the appointment must exist and belong to the same owner & pet.
            VetAppointmentEntity appointment = loadOwnedAppointment(appointmentId, email);
            if (!appointment.getPetId().equals(pet.getId())) {
                throw new AccessDeniedForResourceException(
                        "Appointment " + appointmentId + " belongs to another pet");
            }
        }
        VetRecordEntity record = new VetRecordEntity(
                appointmentId,
                pet.getId(),
                user.getId(),
                request.visitDate());
        record.setDiagnosisText(blankToNull(request.diagnosisText()));
        record.setRecommendationsText(blankToNull(request.recommendationsText()));
        record.setPrescriptionsText(blankToNull(request.prescriptionsText()));
        record.setAttachmentsJson("[]");
        return toRecordDto(recordRepository.save(record));
    }

    /** PATCH semantics: null fields keep their current values. Attachments are managed via upload/delete. */
    @Transactional
    public RecordDto updateRecord(Long id, UpdateRecordRequest request, String email) {
        VetRecordEntity record = loadOwnedRecord(id, email);
        if (request.visitDate() != null) {
            record.setVisitDate(request.visitDate());
        }
        if (request.diagnosisText() != null) {
            record.setDiagnosisText(blankToNull(request.diagnosisText()));
        }
        if (request.recommendationsText() != null) {
            record.setRecommendationsText(blankToNull(request.recommendationsText()));
        }
        if (request.prescriptionsText() != null) {
            record.setPrescriptionsText(blankToNull(request.prescriptionsText()));
        }
        return toRecordDto(record);
    }

    /** Deletes the record row and best-effort removes its attachment files from disk. */
    @Transactional
    public void deleteRecord(Long id, String email) {
        VetRecordEntity record = loadOwnedRecord(id, email);
        for (AttachmentDto attachment : RecordDto.parseAttachments(record.getAttachmentsJson())) {
            fileStorageService.deleteRecordAttachment(attachment.url());
        }
        recordRepository.deleteById(id);
    }

    /** Stores a PDF/image under ./uploads/records/ and appends it to attachments_jsonb. */
    @Transactional
    public RecordDto addRecordAttachment(Long recordId, InputStream data, String originalFilename,
                                         long size, String email) {
        VetRecordEntity record = loadOwnedRecord(recordId, email);
        FileStorageService.StoredAttachment stored =
                fileStorageService.storeRecordAttachment(data, originalFilename, size);
        List<AttachmentDto> attachments =
                new ArrayList<>(RecordDto.parseAttachments(record.getAttachmentsJson()));
        attachments.add(new AttachmentDto(stored.url(), stored.name(), stored.type(), stored.size()));
        record.setAttachmentsJson(RecordDto.writeAttachments(attachments));
        return toRecordDto(record);
    }

    /* ---------- Merged per-pet chronology ---------- */

    /** Combined timeline of appointments + records for one pet, newest event first. */
    @Transactional(readOnly = true)
    public List<HistoryEventDto> getPetHistory(Long petId, String email) {
        UserEntity user = resolveUser(email);
        PetEntity pet = loadOwnedPet(petId, user.getId());

        Stream<HistoryEventDto> appointments =
                appointmentRepository.findByPetIdOrderByScheduledAtDesc(pet.getId()).stream()
                        .map(a -> new HistoryEventDto(HistoryEventDto.Kind.APPOINTMENT,
                                a.getScheduledAt(), toAppointmentDto(a, pet.getName()), null));
        Stream<HistoryEventDto> records =
                recordRepository.findByPetIdOrderByVisitDateDesc(pet.getId()).stream()
                        .map(r -> new HistoryEventDto(HistoryEventDto.Kind.RECORD,
                                r.getVisitDate().atStartOfDay(java.time.ZoneOffset.UTC).toInstant(),
                                null, toRecordDto(r, pet.getName())));

        return Stream.concat(appointments, records)
                .sorted(Comparator.comparing(HistoryEventDto::eventAt).reversed())
                .toList();
    }

    private void applyAppointmentFields(VetAppointmentEntity appointment, String doctorName,
                                        Integer durationMinutes, AppointmentStatus status,
                                        String address, BigDecimal cost,
                                        String currency, String notes) {
        appointment.setDoctorName(blankToNull(doctorName));
        appointment.setDurationMinutes(durationMinutes != null ? durationMinutes : 30);
        appointment.setStatus(status != null ? status : AppointmentStatus.SCHEDULED);
        appointment.setAddress(blankToNull(address));
        appointment.setCost(cost);
        appointment.setCurrency(currency != null ? currency.toUpperCase() : null);
        appointment.setNotes(blankToNull(notes));
    }

    private VetAppointmentEntity loadOwnedAppointment(Long id, String email) {
        UserEntity user = resolveUser(email);
        VetAppointmentEntity appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new AppointmentNotFoundException(id));
        if (!appointment.getOwnerId().equals(user.getId())) {
            // Do not leak existence of other users' appointments.
            throw new AccessDeniedForResourceException("Veterinary appointment not found: " + id);
        }
        return appointment;
    }

    private VetRecordEntity loadOwnedRecord(Long id, String email) {
        UserEntity user = resolveUser(email);
        VetRecordEntity record = recordRepository.findById(id)
                .orElseThrow(() -> new RecordNotFoundException(id));
        if (!record.getOwnerId().equals(user.getId())) {
            throw new AccessDeniedForResourceException("Veterinary record not found: " + id);
        }
        return record;
    }

    private PetEntity loadOwnedPet(Long petId, Long userId) {
        PetEntity pet = petRepository.findByIdAndDeletedFalse(petId)
                .orElseThrow(() -> new PetNotFoundException(petId));
        if (!pet.getOwnerId().equals(userId)) {
            throw new AccessDeniedForResourceException("Pet not found: " + petId);
        }
        return pet;
    }

    private UserEntity resolveUser(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new AccessDeniedForResourceException("User not found"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private List<AppointmentDto> toAppointmentDtoList(List<VetAppointmentEntity> entities) {
        if (entities.isEmpty()) {
            return List.of();
        }
        Map<Long, String> petNames = loadPetNames(entities.stream().map(VetAppointmentEntity::getPetId).toList());
        return entities.stream()
                .map(a -> AppointmentDto.from(a, petNames.getOrDefault(a.getPetId(), "Unknown pet")))
                .toList();
    }

    private List<RecordDto> toRecordDtoList(List<VetRecordEntity> entities) {
        if (entities.isEmpty()) {
            return List.of();
        }
        Map<Long, String> petNames = loadPetNames(entities.stream().map(VetRecordEntity::getPetId).toList());
        return entities.stream()
                .map(r -> RecordDto.from(r, petNames.getOrDefault(r.getPetId(), "Unknown pet")))
                .toList();
    }

    /** Batch-load pet names to avoid N+1 queries. */
    private Map<Long, String> loadPetNames(List<Long> petIds) {
        return petRepository.findAllById(petIds.stream().distinct().toList()).stream()
                .collect(Collectors.toMap(PetEntity::getId, PetEntity::getName, (a, b) -> a));
    }

    private AppointmentDto toAppointmentDto(VetAppointmentEntity entity) {
        String petName = petRepository.findById(entity.getPetId())
                .map(PetEntity::getName)
                .orElse("Unknown pet");
        return AppointmentDto.from(entity, petName);
    }

    private AppointmentDto toAppointmentDto(VetAppointmentEntity entity, String petName) {
        return AppointmentDto.from(entity, petName);
    }

    private RecordDto toRecordDto(VetRecordEntity entity) {
        String petName = petRepository.findById(entity.getPetId())
                .map(PetEntity::getName)
                .orElse("Unknown pet");
        return RecordDto.from(entity, petName);
    }

    private RecordDto toRecordDto(VetRecordEntity entity, String petName) {
        return RecordDto.from(entity, petName);
    }
}
