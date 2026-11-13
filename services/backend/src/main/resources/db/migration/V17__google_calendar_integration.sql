CREATE TABLE google_calendar_connections (
    owner_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,
    calendar_id VARCHAR(255),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    last_error VARCHAR(40),
    sync_locked_until TIMESTAMP WITH TIME ZONE
);

CREATE TABLE google_calendar_oauth_states (
    state_hash VARCHAR(64) PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_verifier TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE google_calendar_events (
    owner_id BIGINT NOT NULL REFERENCES google_calendar_connections(owner_id) ON DELETE CASCADE,
    source_key VARCHAR(80) NOT NULL,
    event_id VARCHAR(100) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    PRIMARY KEY (owner_id, source_key)
);
