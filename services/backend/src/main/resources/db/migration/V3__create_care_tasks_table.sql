CREATE TABLE care_tasks (
    id              BIGSERIAL    PRIMARY KEY,
    pet_id          BIGINT       NOT NULL REFERENCES pets (id),
    owner_id        BIGINT       NOT NULL REFERENCES users (id),
    title           VARCHAR(150) NOT NULL,
    type            VARCHAR(30)  NOT NULL,
    due_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    recurrence_rule VARCHAR(50),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fast lookup of the current user's pending tasks ordered by due date
-- (covers WHERE owner_id = ? AND status = 'PENDING' ORDER BY due_at ASC).
CREATE INDEX idx_care_tasks_upcoming ON care_tasks (owner_id, status, due_at);

-- Fast per-pet task listing.
CREATE INDEX idx_care_tasks_pet ON care_tasks (pet_id);
