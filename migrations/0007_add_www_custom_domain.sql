ALTER TABLE domains ADD COLUMN www_custom_domain_id TEXT;
ALTER TABLE domains ADD COLUMN www_custom_domain_status TEXT NOT NULL DEFAULT 'not_started';