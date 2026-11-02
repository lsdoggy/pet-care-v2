package com.petcare.backend.device;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.petcare.backend.device.dto.DeviceDto;
import com.petcare.backend.device.dto.RegisterDeviceRequest;

import jakarta.validation.Valid;

/**
 * Sprint 6: device token registry. Layering: Controller -> {@link DeviceService} -> Repository.
 */
@RestController
@RequestMapping("/api/v1/devices")
public class DeviceController {

    private final DeviceService deviceService;

    public DeviceController(DeviceService deviceService) {
        this.deviceService = deviceService;
    }

    /** Mobile app sends its Expo push token here on every authenticated cold start. */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    DeviceDto register(@Valid @RequestBody RegisterDeviceRequest request, Authentication authentication) {
        return deviceService.register(request, authentication.getName());
    }

    @GetMapping
    List<DeviceDto> list(Authentication authentication) {
        return deviceService.listMyDevices(authentication.getName());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unregister(@PathVariable Long id, Authentication authentication) {
        deviceService.unregister(id, authentication.getName());
    }
}
