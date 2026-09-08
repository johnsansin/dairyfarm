CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS farms (
 id uuid PRIMARY KEY, name text NOT NULL, city text NOT NULL,
 currency text NOT NULL DEFAULT 'PKR', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS farm_members (
 farm_id uuid NOT NULL REFERENCES farms(id), user_id uuid NOT NULL REFERENCES users(id),
 role text NOT NULL CHECK (role IN ('OWNER','VIEWER')), PRIMARY KEY (farm_id,user_id)
);
CREATE INDEX IF NOT EXISTS farm_members_user_idx ON farm_members(user_id);
CREATE TABLE IF NOT EXISTS audit_logs (
 id uuid PRIMARY KEY, farm_id uuid NOT NULL REFERENCES farms(id),
 user_id uuid NOT NULL REFERENCES users(id), action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
