package com.petcare.backend.task;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.error.AccessDeniedForResourceException;
import com.petcare.backend.error.CareTaskNotFoundException;
import com.petcare.backend.error.InvalidRecurrenceRuleException;
import com.petcare.backend.error.PetNotFoundException;
import com.petcare.backend.pet.PetEntity;
import com.petcare.backend.pet.PetRepository;
import com.petcare.backend.task.dto.CareTaskDto;
import com.petcare.backend.task.dto.CreateTaskRequest;
import com.petcare.backend.task.dto.UpdateTaskRequest;
import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;

@Service
public class CareTaskService {

    /** Supported recurrence units -> ChronoUnit for the simplified "+interval" logic. */
    private static final Map<String, ChronoUnit> RECURRENCE_UNITS = Map.of(
            "DAILY", ChronoUnit.DAYS,
            "WEEKLY", ChronoUnit.WEEKS,
            "MONTHLY", ChronoUnit.MONTHS,
            "YEARLY", ChronoUnit.YEARS);

    private final CareTaskRepository careTaskRepository;
    private final PetRepository petRepository;
    private final UserRepository userRepository;

    public CareTaskService(CareTaskRepository careTaskRepository,
                           PetRepository petRepository,
                           UserRepository userRepository) {
        this.careTaskRepository = careTaskRepository;
        this.petRepository = petRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<CareTaskDto> listMyTasks(String email) {
        UserEntity user = resolveUser(email);
        return toDtoList(careTaskRepository.findByOwnerIdOrderByDueAtAsc(user.getId()));
    }

    /** Pending tasks of the current user, nearest due date first. */
    @Transactional(readOnly = true)
    public List<CareTaskDto> listUpcoming(String email) {
        UserEntity user = resolveUser(email);
        return toDtoList(careTaskRepository.findByOwnerIdAndStatusOrderByDueAtAsc(
                user.getId(), CareTaskStatus.PENDING));
    }

    @Transactional(readOnly = true)
    public CareTaskDto getTask(Long id, String email) {
        CareTaskEntity task = loadOwnedTask(id, email);
        return toDto(task);
    }

    @Transactional
    public CareTaskDto createTask(CreateTaskRequest request, String email) {
        UserEntity user = resolveUser(email);
        PetEntity pet = loadOwnedPet(request.petId(), user.getId());
        CareTaskEntity task = new CareTaskEntity(
                pet.getId(),
                user.getId(),
                request.title().trim(),
                request.type(),
                request.dueAt(),
                normalizeRule(request.recurrenceRule()));
        return toDto(careTaskRepository.save(task));
    }

    /** PATCH semantics: null fields keep their current values. */
    @Transactional
    public CareTaskDto updateTask(Long id, UpdateTaskRequest request, String email) {
        CareTaskEntity task = loadOwnedTask(id, email);
        if (request.title() != null && !request.title().isBlank()) {
            task.setTitle(request.title().trim());
        }
        if (request.type() != null) {
            task.setType(request.type());
        }
        if (request.dueAt() != null) {
            task.setDueAt(request.dueAt());
        }
        if (request.status() != null) {
            task.setStatus(request.status());
        }
        if (request.recurrenceRule() != null) {
            task.setRecurrenceRule(normalizeRule(request.recurrenceRule()));
        }
        return toDto(task);
    }

    @Transactional
    public void deleteTask(Long id, String email) {
        loadOwnedTask(id, email);
        careTaskRepository.deleteById(id);
    }

    /**
     * Marks the task as done. If it carries a recurrence rule ("UNIT:N"),
     * a NEW pending task is created with due_at shifted by N units
     * (simplified logic from the sprint spec: "MONTHLY:1" -> +1 month).
     */
    @Transactional
    public CareTaskDto completeTask(Long id, String email) {
        CareTaskEntity task = loadOwnedTask(id, email);
        if (task.getStatus() == CareTaskStatus.DONE) {
            // Idempotent completion — just return the current state.
            return toDto(task);
        }
        task.setStatus(CareTaskStatus.DONE);

        if (task.getRecurrenceRule() != null && !task.getRecurrenceRule().isBlank()) {
            Instant nextDueAt = applyRecurrence(task.getDueAt(), task.getRecurrenceRule());
            CareTaskEntity next = new CareTaskEntity(
                    task.getPetId(),
                    task.getOwnerId(),
                    task.getTitle(),
                    task.getType(),
                    nextDueAt,
                    task.getRecurrenceRule());
            return toDto(careTaskRepository.save(next));
        }
        return toDto(task);
    }

    /** Parses "UNIT:N" (e.g. "MONTHLY:1") and shifts the given instant. */
    static Instant applyRecurrence(Instant dueAt, String rule) {
        String[] parts = rule.trim().toUpperCase().split(":");
        if (parts.length != 2) {
            throw new InvalidRecurrenceRuleException(rule);
        }
        ChronoUnit unit = RECURRENCE_UNITS.get(parts[0]);
        if (unit == null) {
            throw new InvalidRecurrenceRuleException(rule);
        }
        long interval;
        try {
            interval = Long.parseLong(parts[1]);
        } catch (NumberFormatException e) {
            throw new InvalidRecurrenceRuleException(rule);
        }
        if (interval <= 0) {
            throw new InvalidRecurrenceRuleException(rule);
        }
        return dueAt.plus(interval, unit);
    }

    private List<CareTaskDto> toDtoList(List<CareTaskEntity> tasks) {
        if (tasks.isEmpty()) {
            return List.of();
        }
        // Batch-load pet names to avoid N+1 queries.
        List<Long> petIds = tasks.stream().map(CareTaskEntity::getPetId).distinct().toList();
        Map<Long, String> petNames = petRepository.findAllById(petIds).stream()
                .collect(Collectors.toMap(PetEntity::getId, PetEntity::getName, (a, b) -> a));
        Function<Long, String> nameResolver = petId -> petNames.getOrDefault(petId, "Unknown pet");
        return tasks.stream()
                .map(t -> CareTaskDto.from(t, nameResolver.apply(t.getPetId())))
                .toList();
    }

    private CareTaskDto toDto(CareTaskEntity task) {
        String petName = petRepository.findByIdAndDeletedFalse(task.getPetId())
                .map(PetEntity::getName)
                .orElse("Unknown pet");
        return CareTaskDto.from(task, petName);
    }

    /**
     * Clears the recurrence rule. Bean Validation treats "" as valid for optional
     * fields (and our pattern allows it), so an explicit empty string means "remove rule".
     */
    static String normalizeRule(String rule) {
        if (rule == null || rule.isBlank()) {
            return null;
        }
        return rule.trim().toUpperCase();
    }

    private CareTaskEntity loadOwnedTask(Long id, String email) {
        UserEntity user = resolveUser(email);
        CareTaskEntity task = careTaskRepository.findById(id)
                .orElseThrow(() -> new CareTaskNotFoundException(id));
        if (!task.getOwnerId().equals(user.getId())) {
            // Do not leak existence of other users' tasks.
            throw new AccessDeniedForResourceException("Care task not found: " + id);
        }
        return task;
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
}
