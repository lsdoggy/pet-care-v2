package com.petcare.backend.auth;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.petcare.backend.user.UserService;
import com.petcare.backend.user.dto.AuthResponse;
import com.petcare.backend.user.dto.LoginRequest;
import com.petcare.backend.user.dto.RegisterRequest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService userService;

    private final TaskExecutor accessLinkExecutor;

    public AuthController(UserService userService, @Qualifier("accessLinkExecutor") TaskExecutor accessLinkExecutor) {
        this.userService = userService;
        this.accessLinkExecutor = accessLinkExecutor;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return userService.register(request);
    }

    record RestoreAccountRequest(String token) {}

    @PostMapping("/restore-account")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void restore(@RequestBody RestoreAccountRequest request) {
        userService.restore(request.token());
    }

    record AccessLinkRequest(@NotBlank @Email @Size(max = 255) String email) {}
    record ResetPasswordRequest(String token, @NotBlank @Size(min = 8, max = 72) String password) {}

    @PostMapping("/request-access-link")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void requestAccessLink(@Valid @RequestBody AccessLinkRequest request) {
        try {
            accessLinkExecutor.execute(() -> userService.sendAccessLink(request.email()));
        } catch (TaskRejectedException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Email requests are temporarily unavailable");
        }
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        userService.resetPassword(request.token(), request.password());
    }

    @PostMapping("/login")
    AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return userService.login(request);
    }
}
