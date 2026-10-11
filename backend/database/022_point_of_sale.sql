ALTER TABLE inventory ADD COLUMN sale_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE inventory ADD COLUMN selling_price numeric(18,2) NOT NULL DEFAULT 0 CHECK(selling_price>=0);
CREATE TABLE pos_sales (
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 request_id uuid NOT NULL,
 request_hash text NOT NULL,
 receipt_number text NOT NULL,
 buyer_id uuid,
 customer_name text NOT NULL,
 farm_name text NOT NULL,
 farm_address text,
 farm_phone text,
 currency text NOT NULL,
 payment_method text NOT NULL CHECK(payment_method IN ('Cash','Online transfer')),
 payment_reference text NOT NULL DEFAULT '',
 total numeric(18,2) NOT NULL CHECK(total>0),
 amount_received numeric(18,2) NOT NULL CHECK(amount_received>=total),
 change_due numeric(18,2) NOT NULL CHECK(change_due=amount_received-total),
 user_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(farm_id,buyer_id) REFERENCES buyers(farm_id,id),
 UNIQUE(farm_id,id), UNIQUE(farm_id,request_id), UNIQUE(farm_id,receipt_number)
);
CREATE INDEX pos_sales_farm_created_idx ON pos_sales(farm_id,created_at DESC);
CREATE TABLE pos_sale_items (
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL,
 sale_id uuid NOT NULL,
 item_id uuid NOT NULL,
 position integer NOT NULL,
 name text NOT NULL,
 unit text NOT NULL,
 quantity numeric(18,3) NOT NULL CHECK(quantity>0),
 unit_price numeric(18,2) NOT NULL CHECK(unit_price>=0),
 total numeric(18,2) NOT NULL CHECK(total=round(quantity*unit_price,2)),
 FOREIGN KEY(farm_id,sale_id) REFERENCES pos_sales(farm_id,id),
 FOREIGN KEY(farm_id,item_id) REFERENCES inventory(farm_id,id),
 UNIQUE(sale_id,item_id)
);
