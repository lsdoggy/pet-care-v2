CREATE TABLE vet_record_idempotency (
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation VARCHAR(16) NOT NULL,
    request_key VARCHAR(128) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    response TEXT NOT NULL,
    PRIMARY KEY (owner_id, operation, request_key)
);
