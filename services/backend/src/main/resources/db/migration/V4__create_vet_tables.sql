-- Sprint 4: Veterinary Appointments & Records.
-- Ownership model follows care_tasks: owner_id is denormalized for fast ownership checks.

CREATE TABLE veterinary_appointments (
    id               BIGSERIAL     PRIMARY KEY,
    pet_id           BIGINT        NOT NULL REFERENCES pets (id),
    owner_id         BIGINT        NOT NULL REFERENCES users (id),
    clinic_name      VARCHAR(150)  NOT NULL,
    doctor_name      VARCHAR(150),
    scheduled_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INT           NOT NULL DEFAULT 30
                     CHECK (duration_minutes BETWEEN 5 AND 480),
    status           VARCHAR(20)   NOT NULL DEFAULT 'SCHEDULED'
                     CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
    address          VARCHAR(255),
    cost             NUMERIC(10,2) CHECK (cost IS NULL OR cost >= 0),
    currency         VARCHAR(3),
    notes            TEXT,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Per-pet chronology (history endpoint): WHERE pet_id = ? ORDER BY scheduled_at DESC.
CREATE INDEX idx_vet_appt_pet ON veterinary_appointments (pet_id, scheduled_at DESC);
-- "My appointments" listing.
CREATE INDEX idx_vet_appt_owner ON veterinary_appointments (owner_id, scheduled_at);

CREATE TABLE veterinary_records (
    id                   BIGSERIAL    PRIMARY KEY,
    appointment_id       BIGINT       REFERENCES veterinary_appointments (id), -- optional link
    pet_id               BIGINT       NOT NULL REFERENCES pets (id),
    owner_id             BIGINT       NOT NULL REFERENCES users (id),
    visit_date           DATE         NOT NULL,
    diagnosis_text       TEXT,
    recommendations_text TEXT,
    prescriptions_text   TEXT,
    -- List of attachments: [{"url": "...", "name": "...", "type": "pdf|jpg|...", "size": 123}]
    -- TEXT payload holding JSON; Hibernate maps it with @JdbcTypeCode(SqlTypes.JSON).
    -- Plain TEXT (instead of native JSONB) keeps the migration portable: it runs on
    -- PostgreSQL 17 in production AND on H2 (MODE=PostgreSQL) used by the test suite.
    attachments_jsonb    TEXT         NOT NULL DEFAULT '[]',
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_vet_rec_pet ON veterinary_records (pet_id, visit_date DESC);
CREATE INDEX idx_vet_rec_owner ON veterinary_records (owner_id, visit_date DESC);
CREATE INDEX idx_vet_rec_appt ON veterinary_records (appointment_id);
