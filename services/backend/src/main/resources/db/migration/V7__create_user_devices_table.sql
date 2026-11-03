-- Sprint 6: Mobile device tokens for push notifications (Expo Push Service / FCM under the hood).
-- A user may have several devices; (user_id, token) is unique so re-registration from the same
-- device simply updates last_seen_at.
CREATE TABLE user_devices (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users (id),
    -- Expo push token ("ExponentPushToken[...]") or raw FCM device token.
    token        VARCHAR(512) NOT NULL,
    platform     VARCHAR(10)  NOT NULL DEFAULT 'android'
                 CHECK (platform IN ('ios', 'android', 'web')),
    push_enabled BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_devices_token UNIQUE (user_id, token)
);

-- Device lookup by owner (GET/DELETE /api/v1/devices).
CREATE INDEX idx_user_devices_user ON user_devices (user_id);
