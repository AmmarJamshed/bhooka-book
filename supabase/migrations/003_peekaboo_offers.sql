-- Peekaboo Guru card offers + restaurant entity mapping

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS peekaboo_entity_id INT;

CREATE INDEX IF NOT EXISTS idx_restaurants_peekaboo_entity ON restaurants(peekaboo_entity_id)
  WHERE peekaboo_entity_id IS NOT NULL;

ALTER TABLE special_offers ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE special_offers ADD COLUMN IF NOT EXISTS card_name TEXT;
ALTER TABLE special_offers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE special_offers ADD COLUMN IF NOT EXISTS peekaboo_deal_id TEXT;
ALTER TABLE special_offers ADD COLUMN IF NOT EXISTS peekaboo_entity_id INT;
ALTER TABLE special_offers ADD COLUMN IF NOT EXISTS terms TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_special_offers_peekaboo_deal
  ON special_offers(restaurant_id, peekaboo_deal_id)
  WHERE peekaboo_deal_id IS NOT NULL;
