package com.petcare.backend.notification;

/**
 * Sprint 6: email transport abstraction (implemented by {@link SmtpMailSender}).
 * Exception-free API: returns delivery success so the service can set channel_status.
 */
@FunctionalInterface
public interface MailSender {

    boolean send(String to, String subject, String body);
}
