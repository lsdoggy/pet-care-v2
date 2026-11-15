package com.petcare.backend;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;

final class TestInvites {
    static String issue(JdbcTemplate jdbc) throws Exception {
        String code = (UUID.randomUUID().toString() + UUID.randomUUID()).replace("-", "");
        jdbc.update("insert into registration_invites (code_hash) values (?)", hash(code));
        return code;
    }

    static void revoke(JdbcTemplate jdbc, String code) throws Exception {
        jdbc.update("update registration_invites set revoked_at = current_timestamp where code_hash = ?", hash(code));
    }

    private static String hash(String code) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(code.getBytes(StandardCharsets.US_ASCII)));
    }

    private TestInvites() {
    }
}
