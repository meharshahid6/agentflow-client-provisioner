export type DomainRecord = {
  id: string;
  clientId: string;
  domain: string;
  registrar: string;
  availabilityStatus: string;
  availabilityDetails: string | null;
  purchaseStatus: string;
  purchasedAt: string | null;
  cloudflareZoneId: string | null;
  cloudflareZoneStatus: string;
  assignedNameservers: string[];
  nameserverStatus: string;
  customDomainId: string | null;
  customDomainStatus: string;
  sslStatus: string;
  metaVerificationValue: string | null;
  metaDnsRecordId: string | null;
  metaVerificationStatus: string;
  createdAt: string;
  updatedAt: string;
};

type DomainRow = {
  id: string; client_id: string; domain: string; registrar: string; availability_status: string;
  availability_details: string | null; purchase_status: string; purchased_at: string | null;
  cloudflare_zone_id: string | null; cloudflare_zone_status: string; assigned_nameservers: string | null;
  nameserver_status: string; custom_domain_id: string | null; custom_domain_status: string; ssl_status: string;
  meta_verification_value: string | null; meta_dns_record_id: string | null; meta_verification_status: string;
  created_at: string; updated_at: string;
};

function toDomain(row: DomainRow): DomainRecord {
  let assignedNameservers: string[] = [];
  try { assignedNameservers = JSON.parse(row.assigned_nameservers ?? "[]") as string[]; } catch { assignedNameservers = []; }
  return {
    id: row.id, clientId: row.client_id, domain: row.domain, registrar: row.registrar,
    availabilityStatus: row.availability_status, availabilityDetails: row.availability_details,
    purchaseStatus: row.purchase_status, purchasedAt: row.purchased_at, cloudflareZoneId: row.cloudflare_zone_id,
    cloudflareZoneStatus: row.cloudflare_zone_status, assignedNameservers, nameserverStatus: row.nameserver_status,
    customDomainId: row.custom_domain_id, customDomainStatus: row.custom_domain_status, sslStatus: row.ssl_status,
    metaVerificationValue: row.meta_verification_value, metaDnsRecordId: row.meta_dns_record_id,
    metaVerificationStatus: row.meta_verification_status, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function getDomainByClientId(db: D1Database, clientId: string) {
  const row = await db.prepare("SELECT * FROM domains WHERE client_id = ? ORDER BY created_at DESC LIMIT 1").bind(clientId).first<DomainRow>();
  return row ? toDomain(row) : null;
}

export async function getDomainByHostname(db: D1Database, hostname: string) {
  const row = await db.prepare("SELECT * FROM domains WHERE domain = ? AND custom_domain_status = 'active' LIMIT 1").bind(hostname.toLowerCase()).first<DomainRow>();
  return row ? toDomain(row) : null;
}

export async function getDomainById(db: D1Database, id: string) {
  const row = await db.prepare("SELECT * FROM domains WHERE id = ? LIMIT 1").bind(id).first<DomainRow>();
  return row ? toDomain(row) : null;
}

export async function upsertDomain(db: D1Database, clientId: string, domain: string) {
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO domains (id, client_id, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(domain) DO UPDATE SET client_id = excluded.client_id, updated_at = excluded.updated_at`
  ).bind(id, clientId, normalized, now, now).run();
  return getDomainByClientId(db, clientId);
}

export async function listDomains(db: D1Database) {
  const result = await db.prepare("SELECT * FROM domains ORDER BY updated_at DESC").all<DomainRow>();
  return result.results.map(toDomain);
}

export async function updateDomainFields(db: D1Database, id: string, fields: Record<string, string | null>) {
  const allowed = new Set(["availability_status", "availability_details", "availability_checked_at", "purchase_status", "purchase_confirmation_token", "purchased_at", "cloudflare_zone_id", "cloudflare_zone_status", "assigned_nameservers", "nameserver_status", "custom_domain_id", "custom_domain_status", "ssl_status", "https_checked_at", "meta_verification_value", "meta_dns_record_id", "meta_verification_status"]);
  const entries = Object.entries(fields).filter(([key]) => allowed.has(key));
  if (!entries.length) return false;
  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const result = await db.prepare(`UPDATE domains SET ${assignments}, updated_at = ? WHERE id = ?`)
    .bind(...entries.map(([, value]) => value), new Date().toISOString(), id).run();
  return result.meta.changes > 0;
}