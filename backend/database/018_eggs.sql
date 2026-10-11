CREATE TABLE IF NOT EXISTS eggs (
  id uuid PRIMARY KEY,
  farm_id uuid NOT NULL REFERENCES farms(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  date date NOT NULL,
  batch text,
  eggs integer NOT NULL CHECK (eggs >= 0 AND eggs <= 100000),
  broken integer CHECK (broken >= 0 AND broken <= 100000),
  notes text,
  UNIQUE(farm_id,id)
);
CREATE INDEX IF NOT EXISTS eggs_farm_created_idx ON eggs(farm_id,created_at DESC);
CREATE INDEX IF NOT EXISTS eggs_farm_date_idx ON eggs(farm_id,date DESC);