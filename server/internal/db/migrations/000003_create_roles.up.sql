CREATE TABLE roles (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name   TEXT NOT NULL,
    app_id TEXT REFERENCES apps(id) ON DELETE CASCADE,
    UNIQUE NULLS NOT DISTINCT (name, app_id)
);
