-- Keep the most recently registered owner for each existing push token.
DELETE FROM user_devices
WHERE EXISTS (
    SELECT 1 FROM user_devices newer
    WHERE newer.token = user_devices.token
      AND (newer.last_seen_at > user_devices.last_seen_at
           OR (newer.last_seen_at = user_devices.last_seen_at AND newer.id > user_devices.id))
);
ALTER TABLE user_devices ADD CONSTRAINT uq_user_devices_installation UNIQUE (token);

CREATE TABLE expo_push_receipts (
    id VARCHAR(128) PRIMARY KEY,
    token VARCHAR(512) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_expo_push_receipts_sent_at ON expo_push_receipts (sent_at);
