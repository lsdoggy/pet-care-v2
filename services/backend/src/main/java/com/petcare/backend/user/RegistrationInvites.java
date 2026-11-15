package com.petcare.backend.user;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
class RegistrationInvites {
    private final JdbcTemplate jdbc;
    private final boolean enabled;

    RegistrationInvites(JdbcTemplate jdbc,
                        @Value("${app.registration.enabled:true}") boolean enabled) {
        this.jdbc = jdbc;
        this.enabled = enabled;
    }

    void redeem(String code) {
        if (!enabled) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Registration is closed");
        }
        if (code == null || !code.matches("[a-f0-9]{64}") || jdbc.update("""
                update registration_invites set redeemed_at = current_timestamp
                where code_hash = ? and redeemed_at is null and revoked_at is null
                """, hash(code)) != 1) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid or used invitation");
        }
    }

    private static String hash(String code) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(code.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
