package com.petcare.backend.user;

import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

    Optional<UserEntity> findByEmailIgnoreCase(String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<UserEntity> findForUpdateByEmailIgnoreCase(String email);

    @Modifying
    @Query("update UserEntity u set u.recoveryTokenHash = null where u.recoveryTokenHash = :hash")
    int restoreByRecoveryTokenHash(String hash);

    boolean existsByEmailIgnoreCase(String email);
}
