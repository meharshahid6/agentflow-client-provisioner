CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY NOT NULL,
  business_name TEXT NOT NULL,
  legal_business_name TEXT,
  business_category TEXT NOT NULL,
  business_description TEXT,
  business_email TEXT NOT NULL,
  business_phone TEXT NOT NULL,
  business_address TEXT,
  city TEXT,
  country TEXT NOT NULL,
  preferred_domain TEXT,
  facebook_page_url TEXT,
  instagram_url TEXT,
  services TEXT NOT NULL,
  logo_name TEXT,
  logo_type TEXT,
  logo_size INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients (created_at DESC);
