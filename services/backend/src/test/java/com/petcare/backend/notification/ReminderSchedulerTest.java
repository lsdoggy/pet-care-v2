package com.petcare.backend.notification;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.petcare.backend.pet.PetRepository;
import com.petcare.backend.task.CareTaskEntity;
import com.petcare.backend.task.CareTaskRepository;
import com.petcare.backend.task.CareTaskStatus;
import com.petcare.backend.task.CareTaskType;
import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;

class ReminderSchedulerTest {

    @Test
    void dayAndOverduePreferencesAreIndependent() {
        var tasks = mock(CareTaskRepository.class);
        var pets = mock(PetRepository.class);
        var users = mock(UserRepository.class);
        var notifications = mock(NotificationService.class);
        var scheduler = new ReminderScheduler(tasks, pets, users, notifications, 60);
        var owner = new UserEntity("owner@example.test", "unused", null, null);
        var day = mock(CareTaskEntity.class);
        var overdue = mock(CareTaskEntity.class);
        when(day.getOwnerId()).thenReturn(1L);
        when(overdue.getOwnerId()).thenReturn(1L);
        when(day.getId()).thenReturn(1L);
        when(day.getPetId()).thenReturn(2L);
        when(day.getTitle()).thenReturn("Medication");
        when(day.getType()).thenReturn(CareTaskType.MEDICATION);
        when(day.getDueAt()).thenReturn(Instant.now().plusSeconds(80000));
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        when(tasks.findByStatusAndDayReminderSentFalseAndDueAtGreaterThanAndDueAtLessThanEqual(
                eq(CareTaskStatus.PENDING), any(), any())).thenReturn(List.of(day));
        when(tasks.findByStatusAndOverdueReminderSentFalseAndDueAtLessThanEqual(
                eq(CareTaskStatus.PENDING), any())).thenReturn(List.of(overdue));

        scheduler.remindUpcomingTasks();
        verifyNoInteractions(notifications);

        owner.setDayReminderEnabled(true);
        scheduler.remindUpcomingTasks();
        verify(notifications).push(eq(owner), eq("Care reminder"), any(), any());
        verify(day).markDayReminderSent();
        verify(overdue, never()).markOverdueReminderSent();
    }
}
