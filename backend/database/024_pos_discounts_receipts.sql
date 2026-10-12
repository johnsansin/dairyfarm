ALTER TABLE pos_sales ADD COLUMN subtotal numeric(18,2);
UPDATE pos_sales SET subtotal=total;
ALTER TABLE pos_sales ALTER COLUMN subtotal SET NOT NULL;
ALTER TABLE pos_sales ADD COLUMN discount_type text NOT NULL DEFAULT 'percent' CHECK(discount_type IN ('percent','amount'));
ALTER TABLE pos_sales ADD COLUMN discount_value numeric(18,2) NOT NULL DEFAULT 0 CHECK(discount_value>=0);
ALTER TABLE pos_sales ADD COLUMN discount_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK(discount_amount>=0);
ALTER TABLE pos_sales ADD COLUMN customer_whatsapp text NOT NULL DEFAULT '';
ALTER TABLE pos_sales ADD CONSTRAINT pos_discount_total CHECK(total=subtotal-discount_amount AND discount_amount<subtotal);
CREATE TABLE pos_contacts (
 farm_id uuid NOT NULL REFERENCES farms(id),
 whatsapp text NOT NULL CHECK(whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
 name text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(farm_id,whatsapp)
);
CREATE TABLE pos_receipt_messages (
 farm_id uuid NOT NULL,
 sale_id uuid NOT NULL,
 recipient text NOT NULL CHECK(recipient ~ '^\+[1-9][0-9]{7,14}$'),
 body text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','unknown')),
 last_error text,
 message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(farm_id,sale_id),
 FOREIGN KEY(farm_id,sale_id) REFERENCES pos_sales(farm_id,id)
);
CREATE INDEX pos_receipt_messages_pending_idx ON pos_receipt_messages(created_at) WHERE status='pending';
