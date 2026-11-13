package com.petcare.backend.user;

import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.petcare.backend.notification.MailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.error.EmailAlreadyRegisteredException;
import com.petcare.backend.security.JwtService;
import com.petcare.backend.user.dto.AuthResponse;
import com.petcare.backend.user.dto.LoginRequest;
import com.petcare.backend.user.dto.RegisterRequest;
import com.petcare.backend.user.dto.UserDto;
import com.petcare.backend.user.dto.UpdateProfileRequest;
import com.petcare.backend.notification.dto.NotificationSettingsRequest;

import org.springframework.security.authentication.BadCredentialsException;

@Service
public class UserService {

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final MailSender mailSender;
    private final String recoveryPage;

    public UserService(UserRepository repository, PasswordEncoder passwordEncoder, JwtService jwtService,
                       MailSender mailSender, @Value("${app.account.recovery-page:}") String recoveryPage) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.mailSender = mailSender;
        this.recoveryPage = recoveryPage;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalize(request.email());
        if (repository.existsByEmailIgnoreCase(email)) {
            throw new EmailAlreadyRegisteredException(email);
        }
        UserEntity user = repository.save(new UserEntity(
                email,
                passwordEncoder.encode(request.password()),
                blankToNull(request.firstName()),
                blankToNull(normalizePhone(request.phone()))));
        return AuthResponse.of(jwtService.generateToken(user), UserDto.from(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        UserEntity user = repository.findByEmailIgnoreCase(normalize(request.email()))
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        if (user.isDeactivated() || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid credentials");
        }
        return AuthResponse.of(jwtService.generateToken(user), UserDto.from(user));
    }

    @Transactional(readOnly = true)
    public UserDto findByEmail(String email) {
        return repository.findByEmailIgnoreCase(normalize(email))
                .map(UserDto::from)
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
    }

    @Transactional
    public UserDto updateProfile(UpdateProfileRequest request, String email) {
        UserEntity user = repository.findByEmailIgnoreCase(normalize(email))
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        if (request.firstName() != null) user.setFirstName(blankToNull(request.firstName()));
        if (request.phone() != null) user.setPhone(blankToNull(normalizePhone(request.phone())));
        return UserDto.from(user);
    }

    /** Sprint 6: profile switches — Push On/Off and Email On/Off. */
    @Transactional
    public UserDto updateNotificationSettings(NotificationSettingsRequest request, String email) {
        UserEntity user = repository.findByEmailIgnoreCase(normalize(email))
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        user.setPushNotificationsEnabled(request.pushEnabled());
        user.setEmailNotificationsEnabled(request.emailEnabled());
        if (request.hourReminderEnabled() != null) {
            user.setHourReminderEnabled(request.hourReminderEnabled());
        }
        if (request.dayReminderEnabled() != null) {
            user.setDayReminderEnabled(request.dayReminderEnabled());
        }
        if (request.overdueReminderEnabled() != null) {
            user.setOverdueReminderEnabled(request.overdueReminderEnabled());
        }
        if (request.lowStockNotificationEnabled() != null) {
            user.setLowStockNotificationEnabled(request.lowStockNotificationEnabled());
        }
        return UserDto.from(user);
    }

    @Transactional
    public void deactivate(String email) {
        UserEntity user = repository.findForUpdateByEmailIgnoreCase(normalize(email))
                .filter(account -> !account.isDeactivated())
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        if (recoveryPage.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Account recovery is unavailable");
        }
        URI page;
        try {
            page = URI.create(recoveryPage);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Account recovery is unavailable");
        }
        if (!"https".equalsIgnoreCase(page.getScheme()) || page.getHost() == null || page.getFragment() != null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Account recovery is unavailable");
        }
        byte[] secret = new byte[32];
        RANDOM.nextBytes(secret);
        String token = HexFormat.of().formatHex(secret);
        if (!mailSender.send(user.getEmail(), "Восстановление аккаунта Pet Care",
                "Чтобы восстановить аккаунт, откройте ссылку и подтвердите восстановление:\n"
                        + page + "#" + token)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Could not send recovery email");
        }
        user.deactivate(hash(token));
    }

    @Transactional
    public void restore(String token) {
        if (token == null || !token.matches("[0-9a-f]{64}")
                || repository.restoreByRecoveryTokenHash(hash(token)) != 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid recovery link");
        }
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase();
    }

    /** Design Sprint 1: trim optional profile fields; empty strings become null. */
    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    /** Design Sprint 1: strip visual separators from the phone number before storing. */
    private static String normalizePhone(String phone) {
        if (phone == null) {
            return null;
        }
        return phone.replaceAll("[\\s()\\-]", "");
    }
}
