import { splitRegistrationDomain } from "@/lib/domains/validation";
import { parseProviderResponse } from "./http";

const BASE_URL = "https://developers.hostinger.com";
export type HostingerConfig = { token?: string; fetch?: typeof fetch };
export type RegistrationAvailability = "available" | "unavailable" | "unknown";
export type DomainAvailability = { domain: string; availability: RegistrationAvailability; price: number | null; currency: string | null; raw: unknown };

function rows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  return [record.data, record.result, record.items].find(Array.isArray) as unknown[] | undefined ?? [];
}

export class HostingerClient {
  private readonly requestFetch: typeof fetch;
  constructor(private readonly config: HostingerConfig) { this.requestFetch = config.fetch ?? fetch; }
  isConfigured() { return Boolean(this.config.token?.trim()); }
  private async request(path: string, init: RequestInit = {}) {
    if (!this.isConfigured()) throw new Error("Hostinger is not configured.");
    const response = await this.requestFetch(`${BASE_URL}${path}`, { ...init, headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${this.config.token!.trim()}`, ...init.headers } });
    return parseProviderResponse(response);
  }
  async checkAvailability(domain: string): Promise<DomainAvailability[]> {
    const split = splitRegistrationDomain(domain);
    const payload = await this.request("/api/domains/v1/availability", { method: "POST", body: JSON.stringify({ domain: split.domain, tlds: [split.tld], with_alternatives: false }) });
    const items = rows(payload);
    if (!items.length) throw new Error("Hostinger returned an invalid availability response.");
    return items.map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const price = typeof row.price === "number" ? row.price : typeof row.price === "string" && Number.isFinite(Number(row.price)) ? Number(row.price) : null;
      const availability = row.is_available === true ? "available" : row.is_available === false ? "unavailable" : "unknown";
      return { domain: typeof row.domain === "string" ? row.domain : domain.toLowerCase(), availability, price, currency: typeof row.currency === "string" ? row.currency : null, raw: item };
    });
  }
  listWhoisProfiles() { return this.request("/api/domains/v1/whois", { method: "GET" }); }
  createWhoisProfile(profile: unknown) { return this.request("/api/domains/v1/whois", { method: "POST", body: JSON.stringify(profile) }); }
  listPortfolio() { return this.request("/api/domains/v1/portfolio", { method: "GET" }); }
  async findPortfolioDomain(domain: string) {
    const normalized = domain.trim().toLowerCase();
    return rows(await this.listPortfolio()).find((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return [record.domain, record.name, record.hostname].some((value) => typeof value === "string" && value.toLowerCase() === normalized);
    }) ?? null;
  }
  registerDomain(input: { domain: string; itemId: string; paymentMethodId: string; whoisId: number }) {
    return this.request("/api/domains/v1/portfolio", { method: "POST", body: JSON.stringify({ domain: input.domain, item_id: input.itemId, payment_method_id: input.paymentMethodId, whois_id: input.whoisId }) });
  }
  updateNameservers(domain: string, nameservers: string[]) {
    if (nameservers.length < 2 || nameservers.some((value) => !value.trim())) throw new Error("At least two valid nameservers are required.");
    return this.request(`/api/domains/v1/portfolio/${encodeURIComponent(domain)}/nameservers`, { method: "PUT", body: JSON.stringify({ ns1: nameservers[0], ns2: nameservers[1], ns3: nameservers[2], ns4: nameservers[3] }) });
  }
}