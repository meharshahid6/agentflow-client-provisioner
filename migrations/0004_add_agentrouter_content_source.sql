PRAGMA foreign_keys = OFF;

CREATE TABLE websites_agentrouter (
  id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready_for_publication', 'published')),
  selected_template TEXT NOT NULL
    CHECK (selected_template IN ('modern_business', 'professional_corporate', 'local_service')),
  generated_configuration TEXT NOT NULL,
  content_source TEXT NOT NULL DEFAULT 'deterministic'
    CHECK (content_source IN ('deterministic', 'openai', 'agentrouter')),
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

INSERT INTO websites_agentrouter SELECT * FROM websites;
DROP TABLE websites;
ALTER TABLE websites_agentrouter RENAME TO websites;
CREATE INDEX idx_websites_status ON websites(status);

CREATE TABLE integration_runs_agentrouter (
  id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'agentrouter', 'hostinger', 'cloudflare', 'system')),
  operation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  safe_message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

INSERT INTO integration_runs_agentrouter SELECT * FROM integration_runs;
DROP TABLE integration_runs;
ALTER TABLE integration_runs_agentrouter RENAME TO integration_runs;
CREATE INDEX idx_integration_runs_client_created ON integration_runs(client_id, created_at DESC);

PRAGMA foreign_keys = ON;