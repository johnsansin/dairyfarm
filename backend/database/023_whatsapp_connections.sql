CREATE TABLE whatsapp_connections (
 farm_id uuid PRIMARY KEY REFERENCES farms(id),
 generation uuid NOT NULL,
 linked_by uuid NOT NULL REFERENCES users(id),
 enabled boolean NOT NULL DEFAULT true,
 status text NOT NULL DEFAULT 'connecting' CHECK(status IN ('disconnected','connecting','qr','connected','reconnecting','error')),
 phone_number text,
 account_name text,
 last_error text,
 linked_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(farm_id,generation)
);
CREATE TABLE whatsapp_auth (
 farm_id uuid NOT NULL,
 generation uuid NOT NULL,
 key_type text NOT NULL,
 key_id text NOT NULL,
 encrypted_value text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(farm_id,generation,key_type,key_id),
 FOREIGN KEY(farm_id,generation) REFERENCES whatsapp_connections(farm_id,generation) ON DELETE CASCADE
);
