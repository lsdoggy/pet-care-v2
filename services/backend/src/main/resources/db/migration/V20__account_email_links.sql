ALTER TABLE users ADD COLUMN recovery_token_expires_at TIMESTAMP WITH TIME ZONE;
UPDATE users
    SET recovery_token_expires_at = CURRENT_TIMESTAMP + INTERVAL '24' HOUR
    WHERE recovery_token_hash IS NOT NULL;
ALTER TABLE users ADD COLUMN password_reset_token_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN password_reset_token_expires_at TIMESTAMP WITH TIME ZONE;
CREATE UNIQUE INDEX idx_users_password_reset_token_hash ON users (password_reset_token_hash);
