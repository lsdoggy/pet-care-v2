package com.petcare.backend.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

    private final SecretKey key;
    private final Duration expiration;
    private final UserRepository users;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.expiration}") Duration expiration, UserRepository users) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiration = expiration;
        this.users = users;
    }

    public String generateToken(UserEntity user) {
        Date now = new Date();
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("uid", user.getId())
                .claim("sv", user.getSessionVersion())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiration.toMillis()))
                .signWith(key)
                .compact();
    }

    public String extractSubject(String token) throws JwtException {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        Integer version = claims.get("sv", Integer.class);
        return users.findByEmailIgnoreCase(claims.getSubject())
                .filter(user -> !user.isDeactivated())
                .filter(user -> user.getSessionVersion() == (version == null ? 0 : version))
                .map(UserEntity::getEmail)
                .orElseThrow(() -> new JwtException("Invalid session"));
    }
}
