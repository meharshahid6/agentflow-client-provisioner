ALTER TABLE domains ADD COLUMN ownership_status TEXT NOT NULL DEFAULT 'available_not_owned'
  CHECK (ownership_status IN ('available_not_owned', 'existing_owned_domain', 'purchase_pending', 'purchased'));
ALTER TABLE domains ADD COLUMN meta_public_dns_status TEXT NOT NULL DEFAULT 'not_configured'
  CHECK (meta_public_dns_status IN ('not_configured', 'dns_pending', 'dns_detected', 'failed'));
ALTER TABLE domains ADD COLUMN meta_public_dns_checked_at TEXT;
