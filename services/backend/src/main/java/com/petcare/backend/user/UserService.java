package com.petcare.backend.user;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.error.EmailAlreadyRegisteredException;
import com.petcare.backend.security.JwtService;
import com.petcare.backend.user.dto.AuthResponse;
import com.petcare.backend.user.dto.LoginRequest;
import com.petcare.backend.user.dto.RegisterRequest;
import com.petcare.backend.user.dto.UserDto;
import com.petcare.backend.notification.dto.NotificationSettingsRequest;

import org.springframework.security.authentication.BadCredentialsException;

@Service
public class UserService {

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public UserService(UserRepository repository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
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
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
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

    /** Sprint 6: profile switches — Push On/Off and Email On/Off. */
    @Transactional
    public UserDto updateNotificationSettings(NotificationSettingsRequest request, String email) {
        UserEntity user = repository.findByEmailIgnoreCase(normalize(email))
                .orElseThrow(() -> new BadCredentialsException("Invalid credentials"));
        user.setPushNotificationsEnabled(request.pushEnabled());
        user.setEmailNotificationsEnabled(request.emailEnabled());
        return UserDto.from(user);
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
