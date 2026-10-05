ALTER TABLE outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outbox ADD COLUMN last_error TEXT;
ALTER TABLE outbox ADD COLUMN sent_at TEXT;
ALTER TABLE outbox ADD COLUMN recipient TEXT;
CREATE INDEX IF NOT EXISTS outbox_status_created ON outbox(status,created_at);

-- Every in-app notification also becomes a transactional email job.
CREATE TRIGGER IF NOT EXISTS notifications_email_outbox
AFTER INSERT ON notifications
BEGIN
  INSERT INTO outbox(id,user_id,channel,subject,payload,status)
  VALUES(lower(hex(randomblob(16))),NEW.user_id,'email',NEW.title,
    json_object('title',NEW.title,'record_id',NEW.record_id,'type','notification'),'pending');
END;
