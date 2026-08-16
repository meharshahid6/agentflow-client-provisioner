import type { ClientInput, LogoMetadata } from "./validation";

export type ClientRecord = ClientInput & {
  id: string;
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
  created_at: string;
  updated_at: string;
};

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

  return { id, ...input, createdAt: timestamp, updatedAt: timestamp } satisfies ClientRecord;
}

export async function listClients(db: D1Database) {
  const result = await db.prepare("SELECT * FROM clients ORDER BY created_at DESC").all<ClientRow>();
  return result.results.map(toClientRecord);
}
