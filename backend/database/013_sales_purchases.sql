CREATE TABLE milk_sales(
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 buyer_id uuid NOT NULL,
 sale_date date NOT NULL,
 quantity numeric(18,3) NOT NULL CHECK(quantity>0),
 rate numeric(18,2) NOT NULL CHECK(rate>=0),
 total numeric(18,2) GENERATED ALWAYS AS (round(quantity*rate,2)) STORED,
 payment_status text NOT NULL CHECK(payment_status IN ('Unpaid','Partially paid','Paid')),
 reference text,
 notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 user_id uuid NOT NULL REFERENCES users(id),
 FOREIGN KEY(farm_id,buyer_id) REFERENCES buyers(farm_id,id), UNIQUE(farm_id,id)
);
CREATE INDEX milk_sales_farm_date_idx ON milk_sales(farm_id,sale_date DESC);
CREATE TABLE inventory_purchases(
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 item_id uuid NOT NULL,
 supplier_id uuid NOT NULL,
 purchase_date date NOT NULL,
 quantity numeric(18,3) NOT NULL CHECK(quantity>0),
 unit_cost numeric(18,6) NOT NULL CHECK(unit_cost>=0),
 total numeric(18,2) GENERATED ALWAYS AS (round(quantity*unit_cost,2)) STORED,
 payment_status text NOT NULL CHECK(payment_status IN ('Unpaid','Partially paid','Paid')),
 reference text,
 notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 user_id uuid NOT NULL REFERENCES users(id),
 FOREIGN KEY(farm_id,item_id) REFERENCES inventory(farm_id,id),
 FOREIGN KEY(farm_id,supplier_id) REFERENCES suppliers(farm_id,id), UNIQUE(farm_id,id)
);
CREATE INDEX inventory_purchases_farm_date_idx ON inventory_purchases(farm_id,purchase_date DESC);
