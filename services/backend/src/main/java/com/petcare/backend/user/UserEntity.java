package com.petcare.backend.user;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    /** Design Sprint 1: optional profile fields collected at sign-up. */
    @Column(name = "first_name")
    private String firstName;

    /** Design Sprint 1: optional contact phone (nullable, backward compatible). */
    @Column(name = "phone")
    private String phone;

    /** Sprint 6: user-level channel switches (profile settings Push On/Off). */
    @Column(name = "push_notifications_enabled", nullable = false)
    private boolean pushNotificationsEnabled = true;

    /** Sprint 6: opt-in email notifications (off by default — emails are only for important events). */
    @Column(name = "email_notifications_enabled", nullable = false)
    private boolean emailNotificationsEnabled = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "recovery_token_hash", length = 64)
    private String recoveryTokenHash;

    @Column(name = "session_version", nullable = false)
    private int sessionVersion;

    public boolean isDeactivated() {
        return recoveryTokenHash != null;
    }

    public int getSessionVersion() {
        return sessionVersion;
    }

    public void deactivate(String tokenHash) {
        recoveryTokenHash = tokenHash;
        sessionVersion++;
    }

    protected UserEntity() {
    }

    public UserEntity(String email, String passwordHash) {
        this.email = email;
        this.passwordHash = passwordHash;
    }

    /** Design Sprint 1: extended constructor with optional profile fields. */
    public UserEntity(String email, String passwordHash, String firstName, String phone) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.firstName = firstName;
        this.phone = phone;
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

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) { this.firstName = firstName; }

    public void setPhone(String phone) { this.phone = phone; }

    public String getPhone() {
        return phone;
    }

    @Column(name = "hour_reminder_enabled", nullable = false)
    private boolean hourReminderEnabled = true;

    @Column(name = "day_reminder_enabled", nullable = false)
    private boolean dayReminderEnabled;

    public boolean isDayReminderEnabled() {
        return dayReminderEnabled;
    }

    public void setDayReminderEnabled(boolean enabled) {
        this.dayReminderEnabled = enabled;
    }

    @Column(name = "overdue_reminder_enabled", nullable = false)
    private boolean overdueReminderEnabled;

    public boolean isOverdueReminderEnabled() {
        return overdueReminderEnabled;
    }

    public void setOverdueReminderEnabled(boolean enabled) {
        this.overdueReminderEnabled = enabled;
    }

    @Column(name = "low_stock_notification_enabled", nullable = false)
    private boolean lowStockNotificationEnabled;

    public boolean isLowStockNotificationEnabled() {
        return lowStockNotificationEnabled;
    }

    public void setLowStockNotificationEnabled(boolean enabled) {
        this.lowStockNotificationEnabled = enabled;
    }

    public boolean isHourReminderEnabled() {
        return hourReminderEnabled;
    }

    public void setHourReminderEnabled(boolean hourReminderEnabled) {
        this.hourReminderEnabled = hourReminderEnabled;
    }

    public boolean isPushNotificationsEnabled() {
        return pushNotificationsEnabled;
    }

    public void setPushNotificationsEnabled(boolean pushNotificationsEnabled) {
        this.pushNotificationsEnabled = pushNotificationsEnabled;
    }

    public boolean isEmailNotificationsEnabled() {
        return emailNotificationsEnabled;
    }

    public void setEmailNotificationsEnabled(boolean emailNotificationsEnabled) {
        this.emailNotificationsEnabled = emailNotificationsEnabled;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
