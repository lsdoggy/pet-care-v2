package com.petcare.backend.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Sprint 6: SMTP email delivery via spring-boot-starter-mail (Gmail / Mailgun — see
 * spring.mail.* env vars in application.properties). When SMTP is not configured the
 * bean degrades gracefully: emails are logged and reported as NOT delivered, so the
 * notification row becomes "failed" and the retry pass picks it up later.
 */
@Component
public class SmtpMailSender implements MailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpMailSender.class);

    /** ObjectProvider -> JavaMailSender exists only when spring.mail.host is configured. */
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String fromAddress;

    public SmtpMailSender(ObjectProvider<JavaMailSender> mailSenderProvider,
                          @org.springframework.beans.factory.annotation.Value(
                                  "${spring.mail.from:no-reply@petcare.local}") String fromAddress) {
        this.mailSenderProvider = mailSenderProvider;
        this.fromAddress = fromAddress;
    }

    @Override
    public boolean send(String to, String subject, String body) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            log.info("SMTP not configured (spring.mail.host missing) — email to {} skipped: \"{}\"", to, subject);
            return false;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            sender.send(message);
            return true;
        } catch (Exception e) {
            log.error("SMTP send failed ({})", e.getClass().getSimpleName());
            return false;
        }
    }
}
