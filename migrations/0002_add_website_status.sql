ALTER TABLE clients
ADD COLUMN website_status TEXT NOT NULL DEFAULT 'not_generated'
CHECK (website_status IN ('not_generated', 'draft', 'ready'));
