package com.petcare.backend.notification;

import java.util.List;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class NotificationPersistenceTest {

    @Autowired
    private NotificationRepository notifications;

    @Autowired
    private EntityManager entityManager;

    @Test
    void persistsChannelsAndStatusesInTheMigratedSchema() {
        String email = UUID.randomUUID() + "@example.com";
        entityManager.createNativeQuery("INSERT INTO users (email, password_hash) VALUES (:email, 'unused')")
                .setParameter("email", email)
                .executeUpdate();
        long userId = ((Number) entityManager.createNativeQuery("SELECT id FROM users WHERE email = :email")
                .setParameter("email", email)
                .getSingleResult()).longValue();

        var push = notifications.save(new NotificationEntity(userId, NotificationType.PUSH, "Push", "Body", null));
        var mail = notifications.save(new NotificationEntity(userId, NotificationType.EMAIL, "Email", "Body", null));
        entityManager.flush();
        entityManager.clear();

        assertThat(notifications.countByUserIdAndChannelStatus(userId, ChannelStatus.PENDING)).isEqualTo(2);
        var storedPush = notifications.findById(push.getId()).orElseThrow();
        var storedMail = notifications.findById(mail.getId()).orElseThrow();
        assertThat(storedPush.getType()).isEqualTo(NotificationType.PUSH);
        assertThat(storedMail.getType()).isEqualTo(NotificationType.EMAIL);

        storedPush.setChannelStatus(ChannelStatus.SENT);
        storedMail.setChannelStatus(ChannelStatus.FAILED);
        entityManager.flush();
        entityManager.clear();

        var sentPush = notifications.findById(push.getId()).orElseThrow();
        assertThat(sentPush.getChannelStatus()).isEqualTo(ChannelStatus.SENT);
        assertThat(notifications.findByChannelStatusInOrderByCreatedAtAsc(List.of(ChannelStatus.PENDING, ChannelStatus.FAILED)))
                .extracting(NotificationEntity::getId)
                .contains(mail.getId())
                .doesNotContain(push.getId());
        sentPush.markRead();
        entityManager.flush();
        entityManager.clear();

        assertThat(notifications.findById(push.getId()).orElseThrow().getChannelStatus()).isEqualTo(ChannelStatus.READ);
    }
}
