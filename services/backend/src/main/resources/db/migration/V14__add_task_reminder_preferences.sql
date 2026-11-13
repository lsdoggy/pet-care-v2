ALTER TABLE users ADD COLUMN day_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN overdue_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE care_tasks ADD COLUMN day_reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE care_tasks ADD COLUMN overdue_reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_care_tasks_due_day_reminder ON care_tasks (status, day_reminder_sent, due_at);
CREATE INDEX idx_care_tasks_due_overdue_reminder ON care_tasks (status, overdue_reminder_sent, due_at);
