-- 003_app_features.sql
-- RBAC roles & permissions
CREATE TABLE IF NOT EXISTS roles (
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 name text NOT NULL,
 description text,
 is_system boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(farm_id,name),
 UNIQUE(farm_id,id)
);
CREATE INDEX IF NOT EXISTS roles_farm_created_idx ON roles(farm_id,created_at DESC);

CREATE TABLE IF NOT EXISTS permissions (
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 role_id uuid NOT NULL REFERENCES roles(id),
 module text NOT NULL,
 access text NOT NULL DEFAULT 'read' CHECK (access IN ('read','write','none')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(farm_id,role_id,module),
 UNIQUE(farm_id,id)
);
CREATE INDEX IF NOT EXISTS permissions_farm_created_idx ON permissions(farm_id,created_at DESC);

-- team members with per-farm roles
ALTER TABLE farm_members ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id);
ALTER TABLE farm_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Invited','Suspended'));

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 user_id uuid NOT NULL REFERENCES users(id),
 type text NOT NULL,
 title text NOT NULL,
 body text,
 link text,
 is_read boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(farm_id,id)
);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(farm_id,user_id,is_read,created_at DESC);

-- accounting: chart of accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 code text NOT NULL,
 name text NOT NULL,
 account_type text NOT NULL CHECK (account_type IN ('Asset','Liability','Equity','Income','Expense')),
 category text,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1,
 UNIQUE(farm_id,code),
 UNIQUE(farm_id,id)
);
CREATE INDEX IF NOT EXISTS chart_of_accounts_farm_created_idx ON chart_of_accounts(farm_id,created_at DESC);

-- journal entries (immutable accounting ledger)
CREATE TABLE IF NOT EXISTS journal_entries (
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 account_id uuid NOT NULL,
 entry_date date NOT NULL,
 entry_type text NOT NULL DEFAULT 'General' CHECK (entry_type IN ('General','MilkSale','Expense','Payroll','Distribution','Transfer')),
 description text,
 debit numeric(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
 credit numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
 reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1,
 CHECK (NOT (debit = 0 AND credit = 0)),
 UNIQUE(farm_id,id)
);
CREATE INDEX IF NOT EXISTS journal_entries_farm_created_idx ON journal_entries(farm_id,created_at DESC);
CREATE INDEX IF NOT EXISTS journal_entries_account_idx ON journal_entries(farm_id,account_id,entry_date);

-- application settings (key/value per farm)
CREATE TABLE IF NOT EXISTS farm_settings (
 farm_id uuid PRIMARY KEY REFERENCES farms(id),
 json jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- animal photo
ALTER TABLE animals ADD COLUMN IF NOT EXISTS photo text;
