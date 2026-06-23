CREATE TABLE apps (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    redirect_uris TEXT[] NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
