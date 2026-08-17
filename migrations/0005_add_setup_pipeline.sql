ALTER TABLE domains ADD COLUMN purchase_confirmation_token TEXT;
ALTER TABLE domains ADD COLUMN availability_checked_at TEXT;
ALTER TABLE domains ADD COLUMN https_checked_at TEXT;
CREATE INDEX IF NOT EXISTS idx_domains_hostname_status ON domains(domain, custom_domain_status);