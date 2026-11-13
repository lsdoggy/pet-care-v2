ALTER TABLE users ADD COLUMN recovery_token_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_users_recovery_token_hash ON users (recovery_token_hash);
