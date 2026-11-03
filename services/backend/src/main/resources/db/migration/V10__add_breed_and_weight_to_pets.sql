-- Design Sprint 3: Pets module.
-- Optional profile fields for the pet card/form. Both columns are nullable,
-- so existing rows and API clients keep working (backward compatible).
ALTER TABLE pets
    ADD COLUMN breed     VARCHAR(80),
    ADD COLUMN weight_kg NUMERIC(6, 2);

-- Guard against nonsense weights at the DB level (mirrors service validation).
ALTER TABLE pets
    ADD CONSTRAINT chk_pets_weight_positive CHECK (weight_kg IS NULL OR weight_kg > 0);
