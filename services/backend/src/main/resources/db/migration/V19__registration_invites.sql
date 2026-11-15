CREATE TABLE registration_invites (
    code_hash VARCHAR(64) PRIMARY KEY,
    redeemed_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE
);
