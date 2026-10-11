CREATE TABLE IF NOT EXISTS payments(
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 entry_type text NOT NULL CHECK(entry_type IN ('sale','purchase')),
 sale_kind text CHECK(sale_kind IN ('milk','eggs')),
 sale_id uuid,
 purchase_id uuid,
 party_name text NOT NULL,
 amount numeric(18,2) NOT NULL CHECK(amount>0),
 payment_date date NOT NULL,
 method text NOT NULL DEFAULT 'Cash' CHECK(method IN ('Cash','Bank','Online','Other')),
 reference text,
 notes text,
 user_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(
  (entry_type='sale' AND sale_id IS NOT NULL AND purchase_id IS NULL AND sale_kind IS NOT NULL)
  OR (entry_type='purchase' AND purchase_id IS NOT NULL AND sale_id IS NULL AND sale_kind IS NULL)
 ),
 UNIQUE(farm_id,id)
);
CREATE INDEX IF NOT EXISTS payments_farm_date_idx ON payments(farm_id,payment_date DESC);
CREATE INDEX IF NOT EXISTS payments_sale_idx ON payments(farm_id,sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_purchase_idx ON payments(farm_id,purchase_id) WHERE purchase_id IS NOT NULL;

ALTER TABLE milk_sales ADD COLUMN IF NOT EXISTS paid_amount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE egg_sales ADD COLUMN IF NOT EXISTS paid_amount numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE inventory_purchases ADD COLUMN IF NOT EXISTS paid_amount numeric(18,2) NOT NULL DEFAULT 0;

ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_entry_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_entry_type_check CHECK (entry_type IN ('General','MilkSale','EggSale','Expense','Payroll','Distribution','Transfer','Receipt','Payment'));