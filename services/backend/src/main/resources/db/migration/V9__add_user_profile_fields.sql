-- Design Sprint 1: optional profile fields collected at sign-up.
-- Nullable columns keep full backward compatibility: existing rows and
-- clients that don't send these fields continue to work unchanged.

ALTER TABLE users ADD COLUMN first_name VARCHAR(80);
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
