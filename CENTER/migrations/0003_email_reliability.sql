-- Additive upgrade; do not rerun 0001/0002 manually on an existing database.
ALTER TABLE outbox ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outbox ADD COLUMN first_attempt_at INTEGER;
ALTER TABLE outbox ADD COLUMN request_body TEXT;
ALTER TABLE outbox ADD COLUMN provider_id TEXT;
CREATE TABLE job_locks(name TEXT PRIMARY KEY, token TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX outbox_due ON outbox(status,next_attempt_at);
