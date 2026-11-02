-- Sprint 6: Notification preferences + reminder dedup flag on care tasks.

ALTER TABLE users
    ADD COLUMN push_notifications_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN email_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Scheduler scans pending, not-yet-reminded tasks due within the next hour.
ALTER TABLE care_tasks
    ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index matching the scheduler query exactly (small, selective).
CREATE INDEX idx_care_tasks_due_reminder ON care_tasks (due_at)
    WHERE status = 'PENDING' AND reminder_sent = FALSE;
