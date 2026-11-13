package com.petcare.backend.user;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.petcare.backend.notification.dto.NotificationSettingsRequest;
import com.petcare.backend.user.dto.UserDto;
import com.petcare.backend.user.dto.UpdateProfileRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    UserDto me(Authentication authentication) {
        return userService.findByEmail(authentication.getName());
    }

    @PatchMapping("/me")
    UserDto updateProfile(@Valid @RequestBody UpdateProfileRequest request, Authentication authentication) {
        return userService.updateProfile(request, authentication.getName());
    }

    /** Sprint 6: notification preferences (Push On/Off, Email On/Off) in the profile. */
    @PatchMapping("/notification-settings")
    @ResponseStatus(HttpStatus.OK)
    UserDto updateNotificationSettings(@Valid @RequestBody NotificationSettingsRequest request,
                                       Authentication authentication) {
        return userService.updateNotificationSettings(request, authentication.getName());
    }
}
