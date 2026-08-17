ALTER TABLE clients ADD COLUMN information_reviewed_at TEXT;
ALTER TABLE clients ADD COLUMN logo_object_key TEXT;
ALTER TABLE clients ADD COLUMN logo_storage_status TEXT NOT NULL DEFAULT 'metadata_only'
  CHECK (logo_storage_status IN ('metadata_only', 'stored', 'unavailable'));

CREATE TABLE IF NOT EXISTS websites (
  id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready_for_publication', 'published')),
  selected_template TEXT NOT NULL
    CHECK (selected_template IN ('modern_business', 'professional_corporate', 'local_service')),
  generated_configuration TEXT NOT NULL,
  content_source TEXT NOT NULL DEFAULT 'deterministic'
    CHECK (content_source IN ('deterministic', 'openai')),
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_websites_status ON websites(status);

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  registrar TEXT NOT NULL DEFAULT 'hostinger',
  availability_status TEXT NOT NULL DEFAULT 'not_checked'
    CHECK (availability_status IN ('not_checked', 'available', 'unavailable', 'unknown', 'failed')),
  availability_details TEXT,
  purchase_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (purchase_status IN ('not_started', 'confirmation_required', 'pending', 'purchased', 'failed')),
  purchased_at TEXT,
  cloudflare_zone_id TEXT,
  cloudflare_zone_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (cloudflare_zone_status IN ('not_started', 'pending', 'active', 'failed')),
  assigned_nameservers TEXT,
  nameserver_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (nameserver_status IN ('not_started', 'pending', 'configured', 'failed')),
  custom_domain_id TEXT,
  custom_domain_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (custom_domain_status IN ('not_started', 'pending', 'active', 'failed')),
  ssl_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (ssl_status IN ('not_started', 'pending', 'ready', 'failed')),
  meta_verification_value TEXT,
  meta_dns_record_id TEXT,
  meta_verification_status TEXT NOT NULL DEFAULT 'not_configured'
    CHECK (meta_verification_status IN ('not_configured', 'record_created', 'dns_detected', 'failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_domains_client_id ON domains(client_id);
CREATE INDEX IF NOT EXISTS idx_domains_setup ON domains(purchase_status, cloudflare_zone_status, ssl_status);

CREATE TABLE IF NOT EXISTS integration_runs (
  id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'hostinger', 'cloudflare', 'system')),
  operation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  safe_message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_runs_client_created ON integration_runs(client_id, created_at DESC);