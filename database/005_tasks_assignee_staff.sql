-- 005_tasks_assignee_staff.sql
-- Convert tasks.assignee from a free-text name to a staff reference (uuid + FK).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_name text;
UPDATE tasks SET assignee_name = assignee WHERE assignee_name IS NULL;
ALTER TABLE tasks ALTER COLUMN assignee TYPE uuid USING NULL;
-- Preserve existing demo data: match names back to staff ids where possible.
UPDATE tasks t SET assignee = s.id
FROM staff s
WHERE s.farm_id = t.farm_id AND lower(btrim(s.name)) = lower(btrim(t.assignee_name)) AND t.assignee IS NULL;
ALTER TABLE tasks ADD CONSTRAINT tasks_assignee_fk FOREIGN KEY (farm_id, assignee) REFERENCES staff(farm_id, id);
ALTER TABLE tasks DROP COLUMN IF EXISTS assignee_name;