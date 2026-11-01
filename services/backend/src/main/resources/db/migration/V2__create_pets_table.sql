CREATE TABLE pets (
    id           BIGSERIAL    PRIMARY KEY,
    owner_id     BIGINT       NOT NULL REFERENCES users (id),
    name         VARCHAR(100) NOT NULL,
    species      VARCHAR(20)  NOT NULL,
    birth_date   DATE,
    photo_url    VARCHAR(500),
    deleted      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pets_owner ON pets (owner_id, deleted);
