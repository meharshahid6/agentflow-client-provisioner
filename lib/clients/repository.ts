import type { ClientInput, LogoMetadata } from "./validation";

export type WebsiteStatus = "not_generated" | "draft" | "ready";

export type ClientRecord = ClientInput & {
  id: string;
  websiteStatus: WebsiteStatus;
  informationReviewedAt: string | null;
  logoObjectKey: string | null;
  logoStorageStatus: "metadata_only" | "stored" | "unavailable";
  createdAt: string;
  updatedAt: string;
};

type ClientRow = {
  id: string;
  business_name: string;
  legal_business_name: string | null;
  business_category: string;
  business_description: string | null;
  business_email: string;
  business_phone: string;
  business_address: string | null;
  city: string | null;
  country: string;
  preferred_domain: string | null;
  facebook_page_url: string | null;
  instagram_url: string | null;
  services: string;
  logo_name: string | null;
  logo_type: string | null;
  logo_size: number | null;
  website_status?: string | null;
  information_reviewed_at?: string | null;
  logo_object_key?: string | null;
  logo_storage_status?: string | null;
  created_at: string;
  updated_at: string;
};

function parseWebsiteStatus(value: string | null | undefined): WebsiteStatus {
  return value === "draft" || value === "ready" ? value : "not_generated";
}

function parseServices(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((service): service is string => typeof service === "string") : [];
  } catch {
    return [];
  }
}

function parseLogo(row: ClientRow): LogoMetadata | null {
  if (!row.logo_name || !row.logo_type || row.logo_size === null) return null;
  return { name: row.logo_name, type: row.logo_type, size: row.logo_size };
}

function toClientRecord(row: ClientRow): ClientRecord {
  return {
    id: row.id,
    businessName: row.business_name,
    legalBusinessName: row.legal_business_name ?? "",
    category: row.business_category,
    description: row.business_description ?? "",
    email: row.business_email,
    phone: row.business_phone,
    address: row.business_address ?? "",
    city: row.city ?? "",
    country: row.country,
    domain: row.preferred_domain ?? "",
    facebook: row.facebook_page_url ?? "",
    instagram: row.instagram_url ?? "",
    services: parseServices(row.services),
    logo: parseLogo(row),
    websiteStatus: parseWebsiteStatus(row.website_status),
    informationReviewedAt: row.information_reviewed_at ?? null,
    logoObjectKey: row.logo_object_key ?? null,
    logoStorageStatus: row.logo_storage_status === "stored" || row.logo_storage_status === "unavailable" ? row.logo_storage_status : "metadata_only",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createClient(db: D1Database, input: ClientInput) {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO clients (
        id, business_name, legal_business_name, business_category, business_description,
        business_email, business_phone, business_address, city, country, preferred_domain,
        facebook_page_url, instagram_url, services, logo_name, logo_type, logo_size,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.businessName,
      input.legalBusinessName || null,
      input.category,
      input.description || null,
      input.email,
      input.phone,
      input.address || null,
      input.city || null,
      input.country,
      input.domain || null,
      input.facebook || null,
      input.instagram || null,
      JSON.stringify(input.services),
      input.logo?.name ?? null,
      input.logo?.type ?? null,
      input.logo?.size ?? null,
      timestamp,
      timestamp
    )
    .run();

  return {
    id,
    ...input,
    websiteStatus: "not_generated",
    informationReviewedAt: null,
    logoObjectKey: null,
    logoStorageStatus: "metadata_only",
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies ClientRecord;
}

export async function listClients(db: D1Database) {
  const result = await db.prepare("SELECT * FROM clients ORDER BY created_at DESC").all<ClientRow>();
  return result.results.map(toClientRecord);
}

export async function getClientById(db: D1Database, id: string) {
  const row = await db.prepare("SELECT * FROM clients WHERE id = ? LIMIT 1").bind(id).first<ClientRow>();
  return row ? toClientRecord(row) : null;
}

export async function setClientPreferredDomain(db: D1Database, id: string, domain: string) {
  const updatedAt = new Date().toISOString();
  const result = await db.prepare("UPDATE clients SET preferred_domain = ?, updated_at = ? WHERE id = ?")
    .bind(domain, updatedAt, id).run();
  return { updated: result.meta.changes > 0, updatedAt };
}

export async function updateWebsiteStatus(db: D1Database, id: string, status: WebsiteStatus) {
  const updatedAt = new Date().toISOString();
  const result = await db
    .prepare("UPDATE clients SET website_status = ?, updated_at = ? WHERE id = ?")
    .bind(status, updatedAt, id)
    .run();

  return { updated: result.meta.changes > 0, updatedAt };
}

export async function updateClient(db: D1Database, id: string, input: ClientInput) {
  const updatedAt = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE clients SET
        business_name = ?, legal_business_name = ?, business_category = ?, business_description = ?,
        business_email = ?, business_phone = ?, business_address = ?, city = ?, country = ?,
        preferred_domain = ?, facebook_page_url = ?, instagram_url = ?, services = ?, logo_name = ?,
        logo_type = ?, logo_size = ?, information_reviewed_at = NULL, updated_at = ?
      WHERE id = ?`
    )
    .bind(
      input.businessName, input.legalBusinessName || null, input.category, input.description || null,
      input.email, input.phone, input.address || null, input.city || null, input.country,
      input.domain || null, input.facebook || null, input.instagram || null, JSON.stringify(input.services),
      input.logo?.name ?? null, input.logo?.type ?? null, input.logo?.size ?? null, updatedAt, id
    )
    .run();
  return { updated: result.meta.changes > 0, updatedAt };
}

export async function setClientInformationReviewed(db: D1Database, id: string, reviewed: boolean) {
  const reviewedAt = reviewed ? new Date().toISOString() : null;
  const result = await db.prepare("UPDATE clients SET information_reviewed_at = ?, updated_at = ? WHERE id = ?")
    .bind(reviewedAt, new Date().toISOString(), id).run();
  return { updated: result.meta.changes > 0, reviewedAt };
}

export async function setClientLogoStorage(
  db: D1Database,
  id: string,
  logo: LogoMetadata,
  objectKey: string,
) {
  const result = await db.prepare(
    "UPDATE clients SET logo_name = ?, logo_type = ?, logo_size = ?, logo_object_key = ?, logo_storage_status = 'stored', updated_at = ? WHERE id = ?"
  ).bind(logo.name, logo.type, logo.size, objectKey, new Date().toISOString(), id).run();
  return result.meta.changes > 0;
}

export async function setClientLogoUnavailable(db: D1Database, id: string, logo: LogoMetadata) {
  const result = await db.prepare(
    "UPDATE clients SET logo_name = ?, logo_type = ?, logo_size = ?, logo_object_key = NULL, logo_storage_status = 'unavailable', updated_at = ? WHERE id = ?"
  ).bind(logo.name, logo.type, logo.size, new Date().toISOString(), id).run();
  return result.meta.changes > 0;
}
