package com.petcare.backend.notification;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.pet.PetEntity;
import com.petcare.backend.pet.PetRepository;
import com.petcare.backend.task.CareTaskEntity;
import com.petcare.backend.task.CareTaskRepository;
import com.petcare.backend.task.CareTaskStatus;
import com.petcare.backend.task.CareTaskType;
import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;

/** Sends enabled day, hour and overdue care-task reminders. */
@Component
public class ReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReminderScheduler.class);

    /** Task types considered "important" — these additionally trigger an email. */
    private static final List<CareTaskType> IMPORTANT_TYPES = List.of(CareTaskType.MEDICATION, CareTaskType.VACCINATION);

    private final CareTaskRepository careTaskRepository;
    private final PetRepository petRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final int reminderWindowMinutes;

    public ReminderScheduler(CareTaskRepository careTaskRepository,
                             PetRepository petRepository,
                             UserRepository userRepository,
                             NotificationService notificationService,
                             @Value("${app.notifications.reminder-window-minutes:60}") int reminderWindowMinutes) {
        this.careTaskRepository = careTaskRepository;
        this.petRepository = petRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.reminderWindowMinutes = reminderWindowMinutes;
    }

    /** Runs every minute; scans tasks due within the next hour (V8 partial index backs the query). */
    @Scheduled(fixedDelayString = "${app.notifications.scan-interval-ms:60000}",
               initialDelayString = "${app.notifications.initial-delay-ms:15000}")
    @Transactional
    public void remindUpcomingTasks() {
        Instant now = Instant.now();
        Instant to = now.plusSeconds(reminderWindowMinutes * 60L);
        List<CareTaskEntity> dueTasks = careTaskRepository
                .findByStatusAndReminderSentFalseAndDueAtBetweenOrderByDueAtAsc(CareTaskStatus.PENDING, now, to);
        for (CareTaskEntity task : dueTasks) {
            userRepository.findById(task.getOwnerId()).filter(owner -> !owner.isDeactivated()).filter(UserEntity::isHourReminderEnabled).ifPresent(owner -> {
                sendReminder(task, owner, "Care reminder", "is due " + formatDue(task.getDueAt(), now));
                task.setReminderSent(true);
            });
        }

        for (CareTaskEntity task : careTaskRepository
                .findByStatusAndDayReminderSentFalseAndDueAtGreaterThanAndDueAtLessThanEqual(
                        CareTaskStatus.PENDING, to, now.plusSeconds(86400))) {
            userRepository.findById(task.getOwnerId()).filter(owner -> !owner.isDeactivated()).filter(UserEntity::isDayReminderEnabled).ifPresent(owner -> {
                sendReminder(task, owner, "Care reminder", "is due " + formatDue(task.getDueAt(), now));
                task.markDayReminderSent();
            });
        }

        for (CareTaskEntity task : careTaskRepository
                .findByStatusAndOverdueReminderSentFalseAndDueAtLessThanEqual(CareTaskStatus.PENDING, now)) {
            userRepository.findById(task.getOwnerId()).filter(owner -> !owner.isDeactivated()).filter(UserEntity::isOverdueReminderEnabled).ifPresent(owner -> {
                sendReminder(task, owner, "Overdue care task", "is overdue");
                task.markOverdueReminderSent();
            });
        }
    }

    private void sendReminder(CareTaskEntity task, UserEntity owner, String title, String status) {
        String petName = petRepository.findById(task.getPetId())
                .map(PetEntity::getName).orElse("your pet");
        String body = "\"%s\" for %s %s".formatted(task.getTitle(), petName, status);
        Map<String, Object> payload = Map.of(
                "careTaskId", task.getId(),
                "petId", task.getPetId(),
                "type", task.getType().name().toLowerCase(),
                "dueAt", task.getDueAt().toString());

        notificationService.push(owner, title, body, payload);
        if (IMPORTANT_TYPES.contains(task.getType())) {
            notificationService.email(owner, title, body, payload);
        }
    }

    /** Minimal retry logic: re-deliver pending/failed notifications once per minute. */
    @Scheduled(fixedDelayString = "${app.notifications.retry-interval-ms:60000}",
               initialDelayString = "${app.notifications.initial-delay-ms:30000}")
    public void retryUndelivered() {
        int retried = notificationService.retryPendingAndFailed();
        if (retried > 0) {
            log.info("Notification retry pass: re-delivered {} row(s)", retried);
        }
    }

    private static String formatDue(Instant dueAt, Instant now) {
        long minutes = java.time.Duration.between(now, dueAt).toMinutes();
        if (minutes <= 0) {
            return "now";
        }
        if (minutes < 60) {
            return "in " + minutes + " min";
        }
        long hours = minutes / 60;
        return "in " + hours + " h";
    }
}
