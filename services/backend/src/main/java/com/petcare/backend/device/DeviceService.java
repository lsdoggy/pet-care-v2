package com.petcare.backend.device;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petcare.backend.device.dto.DeviceDto;
import com.petcare.backend.device.dto.RegisterDeviceRequest;
import com.petcare.backend.error.AccessDeniedForResourceException;
import com.petcare.backend.error.DeviceNotFoundException;
import com.petcare.backend.user.UserEntity;
import com.petcare.backend.user.UserRepository;

/**
 * Sprint 6: push device registry. Business logic lives here (Controller -> Service -> Repository).
 */
@Service
public class DeviceService {

    private final UserDeviceRepository deviceRepository;
    private final UserRepository userRepository;

    public DeviceService(UserDeviceRepository deviceRepository, UserRepository userRepository) {
        this.deviceRepository = deviceRepository;
        this.userRepository = userRepository;
    }

    /**
     * Idempotent registration: re-sending the same token from the same user refreshes
     * last_seen_at instead of creating a duplicate row.
     */
    @Transactional
    public DeviceDto register(RegisterDeviceRequest request, String email) {
        UserEntity user = resolveUser(email);
        String token = request.token().trim();
        UserDeviceEntity device = deviceRepository.findByUserIdAndToken(user.getId(), token)
                .orElseGet(() -> deviceRepository.save(
                        new UserDeviceEntity(user.getId(), token, request.normalizedPlatform())));
        // Token survives an OS reinstall/permission change — make sure it can receive pushes again.
        if (!device.isPushEnabled()) {
            device.setPushEnabled(true);
        }
        return DeviceDto.from(device);
    }

    @Transactional(readOnly = true)
    public List<DeviceDto> listMyDevices(String email) {
        UserEntity user = resolveUser(email);
        return deviceRepository.findByUserId(user.getId()).stream()
                .map(DeviceDto::from)
                .toList();
    }

    /** Used on logout so the server stops pushing to a signed-out device. */
    @Transactional
    public void unregister(Long deviceId, String email) {
        UserEntity user = resolveUser(email);
        UserDeviceEntity device = deviceRepository.findByIdAndUserId(deviceId, user.getId())
                .orElseThrow(() -> new DeviceNotFoundException(deviceId));
        deviceRepository.delete(device);
    }

    private UserEntity resolveUser(String email) {
        return userRepository.findByEmailIgnoreCase(email.trim().toLowerCase())
                .orElseThrow(() -> new AccessDeniedForResourceException("User not found"));
    }
}
