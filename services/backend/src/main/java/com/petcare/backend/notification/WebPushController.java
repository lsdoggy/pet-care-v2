package com.petcare.backend.notification;

import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/web-push")
class WebPushController {

    private final WebPushSubscriptions subscriptions;

    WebPushController(WebPushSubscriptions subscriptions) {
        this.subscriptions = subscriptions;
    }

    @GetMapping("/config")
    Map<String, String> config() {
        return Map.of("publicKey", subscriptions.publicKey());
    }

    @PostMapping("/status")
    Map<String, Boolean> status(@Valid @RequestBody EndpointRequest request, Authentication auth) {
        return Map.of("subscribed", subscriptions.isSubscribed(auth.getName(), request.endpoint()));
    }

    @PutMapping("/subscription")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void subscribe(@Valid @RequestBody EndpointRequest request, Authentication auth) {
        subscriptions.subscribe(auth.getName(), request.endpoint());
    }

    @DeleteMapping("/subscription")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unsubscribe(@Valid @RequestBody EndpointRequest request, Authentication auth) {
        subscriptions.unsubscribe(auth.getName(), request.endpoint());
    }

    record EndpointRequest(@NotBlank @Size(max = 2048) String endpoint) {}
}
