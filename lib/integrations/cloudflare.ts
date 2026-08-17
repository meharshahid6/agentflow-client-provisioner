import { parseProviderResponse } from "./http";

const BASE_URL = "https://api.cloudflare.com/client/v4";
export type CloudflareConfig = { token?: string; accountId?: string; workerName?: string; fetch?: typeof fetch };

export class CloudflareClient {
  private readonly requestFetch: typeof fetch;
  constructor(private readonly config: CloudflareConfig) { this.requestFetch = config.fetch ?? fetch; }
  isConfigured() { return Boolean(this.config.token?.trim() && this.config.accountId?.trim() && this.config.workerName?.trim()); }
  private async request(path: string, init: RequestInit = {}) {
    if (!this.isConfigured()) throw new Error("Cloudflare is not configured.");
    const response = await this.requestFetch(`${BASE_URL}${path}`, { ...init, headers: { Authorization: `Bearer ${this.config.token!.trim()}`, "Content-Type": "application/json", ...init.headers } });
    const payload = await parseProviderResponse(response);
    if (payload && typeof payload === "object" && "success" in payload && !(payload as { success: boolean }).success) throw new Error("Cloudflare reported an unsuccessful response.");
    return payload && typeof payload === "object" && "result" in payload ? (payload as { result: unknown }).result : payload;
  }
  listZones(name: string) { return this.request(`/zones?name=${encodeURIComponent(name)}`); }
  async findZone(name: string) {
    const zones = await this.listZones(name);
    return Array.isArray(zones) ? zones.find((zone) => zone && typeof zone === "object" && (zone as { name?: unknown }).name === name) ?? zones[0] ?? null : null;
  }
  createZone(name: string) { return this.request("/zones", { method: "POST", body: JSON.stringify({ account: { id: this.config.accountId }, name, type: "full" }) }); }
  getZone(zoneId: string) { return this.request(`/zones/${encodeURIComponent(zoneId)}`); }
  listDnsRecords(zoneId: string, type?: string, name?: string) { return this.request(`/zones/${encodeURIComponent(zoneId)}/dns_records?${new URLSearchParams({ ...(type ? { type } : {}), ...(name ? { name } : {}) })}`); }
  createDnsRecord(zoneId: string, record: { type: string; name: string; content: string; ttl?: number }) { return this.request(`/zones/${encodeURIComponent(zoneId)}/dns_records`, { method: "POST", body: JSON.stringify({ ...record, ttl: record.ttl ?? 1 }) }); }
  updateDnsRecord(zoneId: string, recordId: string, record: { type: string; name: string; content: string; ttl?: number }) { return this.request(`/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`, { method: "PUT", body: JSON.stringify({ ...record, ttl: record.ttl ?? 1 }) }); }
  async upsertDnsRecord(zoneId: string, record: { type: string; name: string; content: string; ttl?: number }) {
    const existing = await this.listDnsRecords(zoneId, record.type, record.name);
    const match = Array.isArray(existing) ? existing.find((item) => item && typeof item === "object" && (item as { name?: unknown }).name === record.name) as { id?: unknown } | undefined : undefined;
    return typeof match?.id === "string" ? this.updateDnsRecord(zoneId, match.id, record) : this.createDnsRecord(zoneId, record);
  }
  attachWorkerDomain(hostname: string) { return this.request(`/accounts/${encodeURIComponent(this.config.accountId!)}/workers/domains`, { method: "PUT", body: JSON.stringify({ hostname, service: this.config.workerName, environment: "production" }) }); }
  listWorkerDomains() { return this.request(`/accounts/${encodeURIComponent(this.config.accountId!)}/workers/domains`); }
  getWorkerDomain(domainId: string) { return this.request(`/accounts/${encodeURIComponent(this.config.accountId!)}/workers/domains/${encodeURIComponent(domainId)}`); }
}