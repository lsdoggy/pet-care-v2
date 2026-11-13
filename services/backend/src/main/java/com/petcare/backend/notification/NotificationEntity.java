package com.petcare.backend.notification;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Convert;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** Row of the {@code notifications} table (V6 migration). */
@Entity
@Table(name = "notifications")
public class NotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Convert(converter = NotificationTypeConverter.class)
    @Column(nullable = false, length = 10)
    private NotificationType type;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false)
    private String body;

    /** JSON string with extra context for clients, e.g. {"careTaskId":42,"dueAt":"..."}. */
    @Column(name = "payload_json")
    private String payloadJson;

    @Convert(converter = ChannelStatusConverter.class)
    @Column(name = "channel_status", nullable = false, length = 10)
    private ChannelStatus channelStatus = ChannelStatus.PENDING;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected NotificationEntity() {
    }

    public NotificationEntity(Long userId, NotificationType type, String title, String body, String payloadJson) {
        this.userId = userId;
        this.type = type;
        this.title = title;
        this.body = body;
        this.payloadJson = payloadJson;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public NotificationType getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public ChannelStatus getChannelStatus() {
        return channelStatus;
    }

    public void setChannelStatus(ChannelStatus channelStatus) {
        this.channelStatus = channelStatus;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public void setSentAt(Instant sentAt) {
        this.sentAt = sentAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    /** Marks the push as opened by the user (channel_status -> read, see V6 CHECK constraint). */
    public void markRead() {
        this.channelStatus = ChannelStatus.READ;
    }
}
