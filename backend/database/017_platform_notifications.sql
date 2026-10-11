CREATE TABLE IF NOT EXISTS platform_notifications(
  id uuid PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('farm.created','user.created')),
  target_id uuid NOT NULL,
  target_name text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_notifications_created_idx ON platform_notifications(created_at DESC);