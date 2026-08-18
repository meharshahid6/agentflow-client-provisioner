export type DomainRecord = {
  id: string;
  clientId: string;
  domain: string;
  registrar: string;
  availabilityStatus: string;
  availabilityDetails: string | null;
  purchaseStatus: string;
  ownershipStatus: "available_not_owned" | "existing_owned_domain" | "purchase_pending" | "purchased";
  purchasedAt: string | null;
  cloudflareZoneId: string | null;
  cloudflareZoneStatus: string;
  assignedNameservers: string[];
  nameserverStatus: string;
  customDomainId: string | null;
  customDomainStatus: string;
  wwwCustomDomainId: string | null;
  wwwCustomDomainStatus: string;
  sslStatus: string;
  metaVerificationValue: string | null;
  metaDnsRecordId: string | null;
  metaVerificationStatus: string;
  metaPublicDnsStatus: "not_configured" | "dns_pending" | "dns_detected" | "failed";
  createdAt: string;
  updatedAt: string;
};

type DomainRow = {
  id: string; client_id: string; domain: string; registrar: string; availability_status: string;
  availability_details: string | null; purchase_status: string; ownership_status: DomainRecord["ownershipStatus"]; purchased_at: string | null;
  cloudflare_zone_id: string | null; cloudflare_zone_status: string; assigned_nameservers: string | null;
  nameserver_status: string; custom_domain_id: string | null; custom_domain_status: string; www_custom_domain_id: string | null; www_custom_domain_status: string; ssl_status: string;
  meta_verification_value: string | null; meta_dns_record_id: string | null; meta_verification_status: string; meta_public_dns_status: DomainRecord["metaPublicDnsStatus"];
  created_at: string; updated_at: string;
};

function toDomain(row: DomainRow): DomainRecord {
  let assignedNameservers: string[] = [];
  try { assignedNameservers = JSON.parse(row.assigned_nameservers ?? "[]") as string[]; } catch { assignedNameservers = []; }
  return {
    id: row.id, clientId: row.client_id, domain: row.domain, registrar: row.registrar,
    availabilityStatus: row.availability_status, availabilityDetails: row.availability_details,
    purchaseStatus: row.purchase_status, ownershipStatus: row.ownership_status, purchasedAt: row.purchased_at, cloudflareZoneId: row.cloudflare_zone_id,
    cloudflareZoneStatus: row.cloudflare_zone_status, assignedNameservers, nameserverStatus: row.nameserver_status,
    customDomainId: row.custom_domain_id, customDomainStatus: row.custom_domain_status,
    wwwCustomDomainId: row.www_custom_domain_id, wwwCustomDomainStatus: row.www_custom_domain_status, sslStatus: row.ssl_status,
    metaVerificationValue: row.meta_verification_value, metaDnsRecordId: row.meta_dns_record_id,
    metaVerificationStatus: row.meta_verification_status, metaPublicDnsStatus: row.meta_public_dns_status, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function getDomainByClientId(db: D1Database, clientId: string) {
  const row = await db.prepare(
    `SELECT d.*
     FROM domains d
     JOIN clients c ON c.id = d.client_id
     WHERE d.client_id = ?
     ORDER BY CASE WHEN d.domain = c.preferred_domain THEN 0 ELSE 1 END,
       d.updated_at DESC, d.domain ASC, d.id ASC
     LIMIT 1`
  ).bind(clientId).first<DomainRow>();
  return row ? toDomain(row) : null;
}

export function selectPrimaryDomainForClient(
  client: { id: string; domain: string },
  domains: DomainRecord[],
) {
  const candidates = domains.filter((domain) => domain.clientId === client.id);
  const preferred = client.domain.trim().toLowerCase();
  if (preferred) {
    const exact = candidates.find((domain) => domain.domain?.toLowerCase() === preferred);
    if (exact) return exact;
  }
  return candidates.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
      || left.domain.localeCompare(right.domain)
      || left.id.localeCompare(right.id)
  )[0] ?? null;
}

export function buildPortfolioDomainState(
  portfolioDomains: string[],
  clients: Array<{ id: string; domain: string }>,
  domains: DomainRecord[],
) {
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const recordsByDomain = new Map(domains.map((domain) => [domain.domain, domain]));
  return portfolioDomains.map((domain) => {
    const record = recordsByDomain.get(domain);
    const client = record ? clientsById.get(record.clientId) : undefined;
    const isPrimary = Boolean(client?.domain && client.domain.toLowerCase() === domain);
    return {
      domain,
      assignedClientId: isPrimary ? record!.clientId : null,
      isPrimary,
      ownershipStatus: record?.ownershipStatus ?? null,
    };
  });
}

export async function getDomainByHostname(db: D1Database, hostname: string) {
  const row = await db.prepare(
    "SELECT d.* FROM domains d JOIN websites w ON w.client_id = d.client_id WHERE d.domain = ? AND d.custom_domain_status = 'active' AND w.status = 'published' LIMIT 1"
  ).bind(hostname.toLowerCase()).first<DomainRow>();
  return row ? toDomain(row) : null;
}

export async function getDomainByExactDomain(db: D1Database, hostname: string) {
  const row = await db.prepare("SELECT * FROM domains WHERE domain = ? LIMIT 1").bind(hostname).first<DomainRow>();
  return row ? toDomain(row) : null;
}

export async function listDomainsByClientId(db: D1Database, clientId: string) {
  const result = await db.prepare("SELECT * FROM domains WHERE client_id = ? ORDER BY created_at DESC").bind(clientId).all<DomainRow>();
  return result.results.map(toDomain);
}

export async function getDomainById(db: D1Database, id: string) {
  const row = await db.prepare("SELECT * FROM domains WHERE id = ? LIMIT 1").bind(id).first<DomainRow>();
  return row ? toDomain(row) : null;
}

export async function upsertDomain(db: D1Database, clientId: string, domain: string) {
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  const claimed = await db.prepare("SELECT client_id FROM domains WHERE domain = ? LIMIT 1").bind(normalized).first<{ client_id: string }>();
  if (claimed && claimed.client_id !== clientId) throw new Error("This domain is already assigned to another client.");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO domains (id, client_id, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(domain) DO UPDATE SET updated_at = excluded.updated_at WHERE client_id = excluded.client_id`
  ).bind(id, clientId, normalized, now, now).run();
  const saved = await getDomainByExactDomain(db, normalized);
  if (!saved || saved.domain !== normalized) throw new Error("This domain is already assigned to another client.");
  return saved;
}

export async function listDomains(db: D1Database) {
  const result = await db.prepare("SELECT * FROM domains ORDER BY updated_at DESC").all<DomainRow>();
  return result.results.map(toDomain);
}

export async function updateDomainFields(db: D1Database, id: string, fields: Record<string, string | null>) {
  const allowed = new Set(["availability_status", "availability_details", "availability_checked_at", "purchase_status", "ownership_status", "purchase_confirmation_token", "purchased_at", "cloudflare_zone_id", "cloudflare_zone_status", "assigned_nameservers", "nameserver_status", "custom_domain_id", "custom_domain_status", "www_custom_domain_id", "www_custom_domain_status", "ssl_status", "https_checked_at", "meta_verification_value", "meta_dns_record_id", "meta_verification_status", "meta_public_dns_status", "meta_public_dns_checked_at"]);
  const entries = Object.entries(fields).filter(([key]) => allowed.has(key));
  if (!entries.length) return false;
  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const result = await db.prepare(`UPDATE domains SET ${assignments}, updated_at = ? WHERE id = ?`)
    .bind(...entries.map(([, value]) => value), new Date().toISOString(), id).run();
  return result.meta.changes > 0;
}