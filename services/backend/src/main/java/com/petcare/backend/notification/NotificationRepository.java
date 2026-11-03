package com.petcare.backend.notification;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {

    /** Per-user feed, newest first (uses idx_notifications_user from V6). */
    List<NotificationEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** Unread rows for the badge counter shown by web/mobile clients. */
    long countByUserIdAndChannelStatus(Long userId, ChannelStatus status);

    /** Retry pass of the scheduler: rows that were not delivered yet (pending or failed). */
    List<NotificationEntity> findByChannelStatusInOrderByCreatedAtAsc(List<ChannelStatus> statuses);
}
