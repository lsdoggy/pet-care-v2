package com.petcare.backend.device;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/** Row of the {@code user_devices} table (V7 migration): one push-capable device per user. */
@Entity
@Table(name = "user_devices")
public class UserDeviceEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Expo push token ("ExponentPushToken[...]") or raw FCM device token. */
    @Column(nullable = false, length = 512)
    private String token;

    /** Stored lowercase: ios | android | web. */
    @Column(nullable = false, length = 10)
    private String platform = "android";

    @Column(name = "push_enabled", nullable = false)
    private boolean pushEnabled = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    protected UserDeviceEntity() {
    }

    public UserDeviceEntity(Long userId, String token, String platform) {
        this.userId = userId;
        this.token = token;
        this.platform = platform;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        lastSeenAt = now;
    }

    @PreUpdate
    void onUpdate() {
        lastSeenAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getToken() {
        return token;
    }

    public String getPlatform() {
        return platform;
    }

    public boolean isPushEnabled() {
        return pushEnabled;
    }

    public void setPushEnabled(boolean pushEnabled) {
        this.pushEnabled = pushEnabled;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }
}
