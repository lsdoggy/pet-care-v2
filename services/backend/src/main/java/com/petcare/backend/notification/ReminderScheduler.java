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

/**
 * Sprint 6: care-task reminder scheduler (standard {@code @Scheduled}, no Quartz for MVP).
 *
 * <p>Every minute it scans pending tasks with {@code reminder_sent = false} whose due time
 * falls into [now, now + window] (default 60 min, configurable via
 * {@code app.notifications.reminder-window-minutes}) and for each of them:
 * <ol>
 *   <li>creates a row in {@code notifications} (push channel);</li>
 *   <li>sends the push through {@link NotificationService} -> Expo Push Service (FCM/APNs);</li>
 *   <li>sends an email too — only for "important" task types (MEDICATION/VACCINATION) and
 *       only when the user enabled the email switch;</li>
 *   <li>marks the task {@code reminder_sent = true} so it is never reminded twice.</li>
 * </ol>
 * A second job performs the minimal retry pass for undelivered notifications.
 */
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
        if (dueTasks.isEmpty()) {
            return;
        }
        log.info("Reminder scan: {} task(s) due within the next {} min", dueTasks.size(), reminderWindowMinutes);
        for (CareTaskEntity task : dueTasks) {
            UserEntity owner = userRepository.findById(task.getOwnerId()).orElse(null);
            if (owner == null) {
                task.setReminderSent(true); // orphaned task — skip forever
                continue;
            }
            String petName = petRepository.findById(task.getPetId())
                    .map(PetEntity::getName).orElse("your pet");
            String title = "Care reminder";
            String body = "\"%s\" for %s is due %s".formatted(task.getTitle(), petName, formatDue(task.getDueAt(), now));
            Map<String, Object> payload = Map.of(
                    "careTaskId", task.getId(),
                    "petId", task.getPetId(),
                    "type", task.getType().name().toLowerCase(),
                    "dueAt", task.getDueAt().toString());

            notificationService.push(owner, title, body, payload);
            if (IMPORTANT_TYPES.contains(task.getType())) {
                notificationService.email(owner, title, body, payload);
            }
            task.setReminderSent(true);
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
