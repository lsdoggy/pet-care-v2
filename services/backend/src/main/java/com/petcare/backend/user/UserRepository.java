package com.petcare.backend.user;

import java.time.Instant;
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
    @Query("""
            update UserEntity u set u.recoveryTokenHash = null, u.recoveryTokenExpiresAt = null
            where u.recoveryTokenHash = :hash and u.recoveryTokenExpiresAt > :now
            """)
    int restoreByRecoveryTokenHash(String hash, Instant now);

    @Modifying
    @Query("""
            update UserEntity u set u.passwordHash = :passwordHash, u.sessionVersion = u.sessionVersion + 1,
                u.passwordResetTokenHash = null, u.passwordResetTokenExpiresAt = null
            where u.passwordResetTokenHash = :hash and u.recoveryTokenHash is null
                and u.passwordResetTokenExpiresAt > :now
            """)
    int resetPassword(String hash, String passwordHash, Instant now);

    boolean existsByEmailIgnoreCase(String email);
}
