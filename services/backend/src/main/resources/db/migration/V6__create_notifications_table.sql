-- Sprint 6: Notification system.
-- One row per generated notification (push or email) with its delivery status.
CREATE TABLE notifications (
    id             BIGSERIAL    PRIMARY KEY,
    user_id        BIGINT       NOT NULL REFERENCES users (id),
    -- Channel enum stored lowercase per spec: push | email
    type           VARCHAR(10)  NOT NULL CHECK (type IN ('push', 'email')),
    title          VARCHAR(150) NOT NULL,
    body           TEXT         NOT NULL,
    -- Arbitrary JSON payload (e.g. {"careTaskId":42,"dueAt":"..."}); validated in the service layer.
    payload_json   TEXT,
    -- Delivery state machine: pending -> sent | failed; push rows may later become read.
    channel_status VARCHAR(10)  NOT NULL DEFAULT 'pending'
                   CHECK (channel_status IN ('sent', 'failed', 'read', 'pending')),
    sent_at        TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Per-user feed ordered by newest first (GET /api/v1/notifications).
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);

-- Scheduler diagnostics: recent sends by status.
CREATE INDEX idx_notifications_status ON notifications (channel_status, created_at DESC);
