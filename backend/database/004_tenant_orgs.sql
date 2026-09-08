CREATE TABLE IF NOT EXISTS organizations (
 id uuid PRIMARY KEY,
 name text NOT NULL,
 slug text NOT NULL,
 created_by uuid REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(slug)
);
CREATE INDEX IF NOT EXISTS organizations_created_idx ON organizations(created_at DESC);

CREATE TABLE IF NOT EXISTS organization_members (
 org_id uuid NOT NULL REFERENCES organizations(id),
 user_id uuid NOT NULL REFERENCES users(id),
 role text NOT NULL CHECK (role IN ('OWNER','ADMIN','MEMBER')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (org_id,user_id)
);
CREATE INDEX IF NOT EXISTS organization_members_user_idx ON organization_members(user_id);

ALTER TABLE farms ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS farms_organization_created_idx ON farms(organization_id,created_at DESC);
