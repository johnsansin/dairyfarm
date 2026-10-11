CREATE TABLE IF NOT EXISTS egg_sales(
 id uuid PRIMARY KEY,
 farm_id uuid NOT NULL REFERENCES farms(id),
 buyer_id uuid NOT NULL,
 sale_date date NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0),
 rate numeric(18,4) NOT NULL CHECK(rate>=0),
 total numeric(18,2) GENERATED ALWAYS AS (round(quantity*rate,2)) STORED,
 payment_status text NOT NULL CHECK(payment_status IN ('Unpaid','Partially paid','Paid')),
 reference text,
 notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 user_id uuid NOT NULL REFERENCES users(id),
 FOREIGN KEY(farm_id,buyer_id) REFERENCES buyers(farm_id,id), UNIQUE(farm_id,id)
);
CREATE INDEX egg_sales_farm_date_idx ON egg_sales(farm_id,sale_date DESC);