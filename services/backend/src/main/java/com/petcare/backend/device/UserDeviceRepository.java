package com.petcare.backend.device;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UserDeviceRepository extends JpaRepository<UserDeviceEntity, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<UserDeviceEntity> findByToken(String token);

    /** Devices that should actually receive pushes for the given owner. */
    List<UserDeviceEntity> findByUserIdAndPushEnabledTrue(Long userId);

    List<UserDeviceEntity> findByUserId(Long userId);

    @Modifying
    @Query("DELETE FROM UserDeviceEntity device WHERE device.id = :id AND device.userId = :userId")
    int deleteOwnedDevice(Long id, Long userId);
}
