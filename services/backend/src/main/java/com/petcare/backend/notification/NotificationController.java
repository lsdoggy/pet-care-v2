package com.petcare.backend.notification;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;

import com.petcare.backend.notification.dto.NotificationDto;

/**
 * Sprint 6: notification feed endpoints. Layering: Controller -> {@link NotificationService} -> Repository.
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    /** Per-user feed, newest first. */
    @GetMapping
    List<NotificationDto> list(Authentication authentication) {
        return notificationService.listForUser(authentication.getName());
    }

    /** Unread counter for the bell badge on web/mobile. */
    @GetMapping("/unread-count")
    long unreadCount(Authentication authentication) {
        return notificationService.unreadCount(authentication.getName());
    }

    /** Mark a delivered notification as read (channel_status sent -> read). */
    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.OK)
    NotificationDto markRead(@PathVariable Long id, Authentication authentication) {
        return notificationService.markRead(id, authentication.getName());
    }
}
