import type { WebsiteConfiguration, WebsiteContentSource, WebsiteTemplate } from "./configuration";

export type WebsiteRecord = {
  id: string;
  clientId: string;
  status: "draft" | "ready_for_publication" | "published";
  selectedTemplate: WebsiteTemplate;
  configuration: WebsiteConfiguration;
  contentSource: WebsiteContentSource;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type WebsiteRow = {
  id: string;
  client_id: string;
  status: WebsiteRecord["status"];
  selected_template: WebsiteTemplate;
  generated_configuration: string;
  content_source: WebsiteRecord["contentSource"];
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function parseRow(row: WebsiteRow): WebsiteRecord | null {
  try {
    return {
      id: row.id,
      clientId: row.client_id,
      status: row.status,
      selectedTemplate: row.selected_template,
      configuration: JSON.parse(row.generated_configuration) as WebsiteConfiguration,
      contentSource: row.content_source,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch {
    return null;
  }
}

export async function getWebsiteByClientId(db: D1Database, clientId: string) {
  const row = await db.prepare("SELECT * FROM websites WHERE client_id = ? LIMIT 1").bind(clientId).first<WebsiteRow>();
  return row ? parseRow(row) : null;
}

export async function listWebsites(db: D1Database) {
  const result = await db.prepare("SELECT * FROM websites ORDER BY updated_at DESC").all<WebsiteRow>();
  return result.results.map(parseRow).filter((website): website is WebsiteRecord => website !== null);
}

export async function saveWebsite(
  db: D1Database,
  clientId: string,
  selectedTemplate: WebsiteTemplate,
  configuration: WebsiteConfiguration,
  contentSource: WebsiteRecord["contentSource"],
) {
  const existing = await getWebsiteByClientId(db, clientId);
  const now = new Date().toISOString();
  const id = existing?.id ?? crypto.randomUUID();
  await db.prepare(
    `INSERT INTO websites (id, client_id, status, selected_template, generated_configuration, content_source, reviewed_at, created_at, updated_at)
     VALUES (?, ?, 'draft', ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(client_id) DO UPDATE SET status = 'draft', selected_template = excluded.selected_template,
       generated_configuration = excluded.generated_configuration, content_source = excluded.content_source,
       reviewed_at = NULL, updated_at = excluded.updated_at`
  ).bind(id, clientId, selectedTemplate, JSON.stringify(configuration), contentSource, now, now).run();
  return getWebsiteByClientId(db, clientId);
}

export async function setWebsiteReview(db: D1Database, clientId: string, reviewed: boolean) {
  const reviewedAt = reviewed ? new Date().toISOString() : null;
  const status = reviewed ? "ready_for_publication" : "draft";
  const result = await db.prepare("UPDATE websites SET status = ?, reviewed_at = ?, updated_at = ? WHERE client_id = ?")
    .bind(status, reviewedAt, new Date().toISOString(), clientId).run();
  return { updated: result.meta.changes > 0, reviewedAt, status };
}

export async function setWebsitePublished(db: D1Database, clientId: string, published: boolean) {
  const status = published ? "published" : "ready_for_publication";
  const result = await db.prepare("UPDATE websites SET status = ?, updated_at = ? WHERE client_id = ? AND status IN ('ready_for_publication', 'published')")
    .bind(status, new Date().toISOString(), clientId).run();
  return { updated: result.meta.changes > 0, status };
}

export async function updateWebsiteTemplate(db: D1Database, clientId: string, template: WebsiteTemplate) {
  const website = await getWebsiteByClientId(db, clientId);
  if (!website) return null;
  const configuration = { ...website.configuration, selectedTemplate: template };
  const result = await db.prepare(
    "UPDATE websites SET selected_template = ?, generated_configuration = ?, updated_at = ? WHERE client_id = ?"
  ).bind(template, JSON.stringify(configuration), new Date().toISOString(), clientId).run();
  return result.meta.changes > 0 ? getWebsiteByClientId(db, clientId) : null;
}

export async function synchronizeWebsitePreferredDomain(db: D1Database, clientId: string, preferredDomain: string) {
  const website = await getWebsiteByClientId(db, clientId);
  if (!website) return null;
  const configuration = { ...website.configuration, online: { ...website.configuration.online, preferredDomain } };
  const result = await db.prepare("UPDATE websites SET generated_configuration = ?, updated_at = ? WHERE client_id = ?")
    .bind(JSON.stringify(configuration), new Date().toISOString(), clientId).run();
  return result.meta.changes > 0 ? getWebsiteByClientId(db, clientId) : null;
}

export async function countWebsitesReady(db: D1Database) {
  const row = await db.prepare("SELECT COUNT(*) AS count FROM websites WHERE status IN ('ready_for_publication', 'published')").first<{ count: number }>();
  return row?.count ?? 0;
}