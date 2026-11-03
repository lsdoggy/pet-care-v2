package com.petcare.backend.device;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserDeviceRepository extends JpaRepository<UserDeviceEntity, Long> {

    Optional<UserDeviceEntity> findByUserIdAndToken(Long userId, String token);

    /** Devices that should actually receive pushes for the given owner. */
    List<UserDeviceEntity> findByUserIdAndPushEnabledTrue(Long userId);

    List<UserDeviceEntity> findByUserId(Long userId);

    Optional<UserDeviceEntity> findByIdAndUserId(Long id, Long userId);
}
