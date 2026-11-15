package com.petcare.backend.device;

import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

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
    private final TransactionTemplate registrationTransaction;

    public DeviceService(UserDeviceRepository deviceRepository, UserRepository userRepository,
                         PlatformTransactionManager transactionManager) {
        this.deviceRepository = deviceRepository;
        this.userRepository = userRepository;
        this.registrationTransaction = new TransactionTemplate(transactionManager);
        this.registrationTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Idempotent registration: re-sending the same token from the same user refreshes
     * last_seen_at instead of creating a duplicate row. Switching accounts transfers ownership.
     */
    public DeviceDto register(RegisterDeviceRequest request, String email) {
        String token = request.token().trim();
        String platform = request.normalizedPlatform();
        try {
            return registrationTransaction.execute(status -> register(token, platform, email, null));
        } catch (DataIntegrityViolationException race) {
            // A first registration in another transaction may have inserted the same token.
            return registrationTransaction.execute(status -> register(token, platform, email, race));
        }
    }

    private DeviceDto register(String token, String platform, String email, DataIntegrityViolationException race) {
        Long userId = resolveUser(email).getId();
        UserDeviceEntity device = deviceRepository.findByToken(token).orElseGet(() -> {
            if (race != null) {
                throw race;
            }
            return deviceRepository.save(new UserDeviceEntity(userId, token, platform));
        });
        device.register(userId, platform);
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
        if (deviceRepository.deleteOwnedDevice(deviceId, user.getId()) == 0) {
            throw new DeviceNotFoundException(deviceId);
        }
    }

    private UserEntity resolveUser(String email) {
        return userRepository.findByEmailIgnoreCase(email.trim().toLowerCase())
                .orElseThrow(() -> new AccessDeniedForResourceException("User not found"));
    }
}
