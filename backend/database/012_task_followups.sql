CREATE TABLE IF NOT EXISTS task_followups (
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 task_id uuid NOT NULL,
 follow_up_date date NOT NULL,
 status text NOT NULL CHECK (status IN ('Pending','In progress','Resolved','Needs another follow-up')),
 notes text NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (farm_id,task_id) REFERENCES tasks(farm_id,id) ON DELETE CASCADE,
 UNIQUE(farm_id,id)
);
CREATE INDEX IF NOT EXISTS task_followups_task_date_idx ON task_followups(farm_id,task_id,follow_up_date DESC,created_at DESC);
