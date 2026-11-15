package com.petcare.backend.notification;

import java.io.IOException;
import java.time.Instant;
import java.time.ZoneOffset;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.petcare.backend.error.AccessDeniedForResourceException;
import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;

@Service
class WebPushSubscriptions {

    private static final Logger log = LoggerFactory.getLogger(WebPushSubscriptions.class);

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final WebPushTransport transport;

    WebPushSubscriptions(JdbcTemplate jdbc, UserRepository users, WebPushTransport transport) {
        this.jdbc = jdbc;
        this.users = users;
        this.transport = transport;
    }

    String publicKey() {
        return transport.publicKey();
    }

    void subscribe(String email, String endpoint) {
        if (!transport.enabled()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Web Push is unavailable");
        }
        try {
            WebPushTransport.validateEndpoint(endpoint);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Apple Web Push endpoint");
        }
        long owner = ownerId(email);
        try {
            jdbc.update("INSERT INTO web_push_subscriptions (user_id, endpoint) VALUES (?, ?)", owner, endpoint);
        } catch (DuplicateKeyException e) {
            if (!ownsEndpoint(owner, endpoint)) {
                throw new AccessDeniedForResourceException("Subscription unavailable");
            }
        }
    }

    boolean isSubscribed(String email, String endpoint) {
        return ownsEndpoint(ownerId(email), endpoint);
    }

    void unsubscribe(String email, String endpoint) {
        jdbc.update("DELETE FROM web_push_subscriptions WHERE user_id = ? AND endpoint = ?",
                ownerId(email), endpoint);
    }

    Delivery deliver(long userId, Instant notificationCreatedAt) {
        if (!transport.enabled() || notificationCreatedAt.isBefore(Instant.now().minusSeconds(300))) {
            return new Delivery(false, false);
        }
        var subscriptions = jdbc.query("""
                SELECT id, endpoint FROM web_push_subscriptions WHERE user_id = ? AND created_at <= ?
                """, (rs, index) -> new Subscription(rs.getLong(1), rs.getString(2)), userId,
                notificationCreatedAt.atOffset(ZoneOffset.UTC));
        boolean delivered = false;
        for (Subscription subscription : subscriptions) {
            try {
                int status = transport.send(subscription.endpoint());
                if (status == 404 || status == 410) {
                    jdbc.update("DELETE FROM web_push_subscriptions WHERE id = ?", subscription.id());
                } else if (status >= 200 && status < 300) {
                    delivered = true;
                } else {
                    log.warn("Apple Web Push returned HTTP {}", status);
                }
            } catch (IOException | IllegalArgumentException e) {
                log.warn("Apple Web Push request failed ({})", e.getClass().getSimpleName());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        return new Delivery(!subscriptions.isEmpty(), delivered);
    }

    private boolean ownsEndpoint(long owner, String endpoint) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM web_push_subscriptions WHERE user_id = ? AND endpoint = ?)
                """, Boolean.class, owner, endpoint));
    }

    private long ownerId(String email) {
        return users.findByEmailIgnoreCase(email).filter(user -> !user.isDeactivated())
                .map(UserEntity::getId)
                .orElseThrow(() -> new AccessDeniedForResourceException("User not found"));
    }

    record Delivery(boolean attempted, boolean accepted) {}

    private record Subscription(long id, String endpoint) {}
}
