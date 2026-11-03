-- Sprint 6: Notification preferences + reminder dedup flag on care tasks.

ALTER TABLE users ADD COLUMN push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN email_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Scheduler scans pending, not-yet-reminded tasks due within the next hour.
ALTER TABLE care_tasks ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index matching the scheduler query exactly (small, selective).
-- NOTE: H2 (test scope, MODE=PostgreSQL) does not support partial indexes; plain composite
-- index is semantically equivalent for both engines and Postgres still uses it for the scan.
CREATE INDEX idx_care_tasks_due_reminder ON care_tasks (status, reminder_sent, due_at);
