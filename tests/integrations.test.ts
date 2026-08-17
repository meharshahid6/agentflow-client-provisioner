import assert from "node:assert/strict";
import test from "node:test";

import { validateMetaVerification, isValidHostname, normalizeHostname } from "../lib/domains/validation";
import { hasExpectedTxtAnswer, normalizeTxtAnswer } from "../lib/domains/public-dns";
import { getNextSetupOperation } from "../lib/domains/setup-sequence";
import { CloudflareClient } from "../lib/integrations/cloudflare";
import { HostingerClient } from "../lib/integrations/hostinger";
import { ProviderRequestError } from "../lib/integrations/http";
import { getProviderStatuses, getRuntimeProviderStatuses } from "../lib/integrations/provider-status";
import { createDeterministicContent, selectTemplateForCategory } from "../lib/websites/configuration";
import { resolvePublicPath } from "../lib/domains/public-path";
import type { ClientRecord } from "../lib/clients/repository";
import type { DomainRecord } from "../lib/domains/repository";

test("domain and Meta values are validated", () => {
  assert.equal(normalizeHostname("https://WWW.Example.com/path"), "example.com");
  assert.equal(isValidHostname("client-a.com"), true);
  assert.equal(isValidHostname("not a domain"), false);
  assert.equal(validateMetaVerification("facebook-domain-verification=abc_DEF-123").valid, true);
  assert.equal(validateMetaVerification("abc_DEF-123").valid, false);
});

test("provider status never returns values", () => {
  const statuses = getProviderStatuses({ DB: {}, AI_PROVIDER: "agentrouter", AI_BASE_URL: "https://co.agentrouter.org/v1", AI_API_KEY: "secret", AI_MODEL: "gpt-5.6-sol" });
  assert.deepEqual(statuses, { d1: "Configured", agentrouter: "Configured", r2: "Not configured", hostinger: "Not configured", cloudflare: "Not configured" });
  assert.equal(JSON.stringify(statuses).includes("secret"), false);
});

test("latest provider failures report runtime availability without leaking values", async () => {
  const DB = { prepare: () => ({ all: async () => ({ results: [{ provider: "agentrouter", status: "failed" }, { provider: "cloudflare", status: "failed" }] }) }) } as unknown as D1Database;
  const statuses = await getRuntimeProviderStatuses({ DB, AI_PROVIDER: "agentrouter", AI_BASE_URL: "https://provider.example/v1", AI_API_KEY: "secret", AI_MODEL: "model", CLOUDFLARE_API_TOKEN: "secret", CLOUDFLARE_ACCOUNT_ID: "account", CLOUDFLARE_WORKER_NAME: "worker" });
  assert.equal(statuses.agentrouter, "External auth required");
  assert.equal(statuses.cloudflare, "Unavailable");
  assert.equal(JSON.stringify(statuses).includes("secret"), false);
});

test("Hostinger availability and purchase use documented contracts", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const mockedFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/availability")) return Response.json([{ domain: "example.com", available: true, price: "12.99", currency: "USD" }]);
    return Response.json({ id: "order-1" });
  };
  const client = new HostingerClient({ token: "test-token", fetch: mockedFetch });
  const availability = await client.checkAvailability("example.com");
  assert.equal(availability[0].available, true);
  assert.equal(availability[0].price, 12.99);
  await client.registerDomain({ domain: "example.com", itemId: "item", paymentMethodId: "payment", whoisId: 1 });
  assert.equal(calls[1].url.endsWith("/api/domains/v1/portfolio"), true);
  assert.equal(calls[1].init?.method, "POST");
});

test("Hostinger handles wrapped pricing, portfolio lookup, WHOIS, and nameservers", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const mockedFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/availability")) return Response.json({ data: [{ domain: "example.com", available: true, price: "9.50", currency: "USD" }] });
    if (String(url).endsWith("/portfolio") && init?.method === "GET") return Response.json({ items: [{ domain: "example.com", status: "active" }] });
    return Response.json({ ok: true });
  };
  const client = new HostingerClient({ token: "test-token", fetch: mockedFetch });
  assert.equal((await client.checkAvailability("example.com"))[0].price, 9.5);
  assert.deepEqual(await client.findPortfolioDomain("EXAMPLE.COM"), { domain: "example.com", status: "active" });
  await client.listWhoisProfiles();
  await client.updateNameservers("example.com", ["a.ns.cloudflare.com", "b.ns.cloudflare.com"]);
  assert.equal(calls.at(-1)?.init?.method, "PUT");
  assert.throws(() => client.updateNameservers("example.com", ["only-one.example"]), /At least two/);
});

test("provider errors are parsed without request secrets", async () => {
  const client = new HostingerClient({ token: "test-token", fetch: async () => Response.json({ error: "Domain unavailable", correlation_id: "safe-id" }, { status: 422 }) });
  await assert.rejects(() => client.listPortfolio(), (error) => error instanceof ProviderRequestError && error.details.status === 422 && error.message === "Domain unavailable" && !error.message.includes("test-token"));
});

test("Cloudflare zone, DNS, and shared Worker calls are shaped correctly", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const mockedFetch: typeof fetch = async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ success: true, result: { id: "resource-1", status: "active" } }); };
  const client = new CloudflareClient({ token: "test-token", accountId: "account", workerName: "shared-worker", fetch: mockedFetch });
  await client.createZone("example.com");
  await client.createDnsRecord("zone", { type: "TXT", name: "example.com", content: "facebook-domain-verification=abc_DEF-123" });
  await client.attachWorkerDomain("example.com");
  assert.equal(calls[0].url.endsWith("/zones"), true);
  assert.equal(calls[1].url.includes("/zones/zone/dns_records"), true);
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { hostname: "example.com", service: "shared-worker", environment: "production" });
});

test("Cloudflare finds zones and upserts existing DNS records non-destructively", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const mockedFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/zones?name=")) return Response.json({ success: true, result: [{ id: "zone-1", name: "example.com", status: "active", name_servers: ["a.ns.cloudflare.com", "b.ns.cloudflare.com"] }] });
    if (String(url).includes("/dns_records?") && init?.method === undefined) return Response.json({ success: true, result: [{ id: "record-1", name: "example.com", content: "old" }] });
    return Response.json({ success: true, result: { id: "record-1" } });
  };
  const client = new CloudflareClient({ token: "test-token", accountId: "account", workerName: "worker", fetch: mockedFetch });
  assert.equal((await client.findZone("example.com") as { id: string }).id, "zone-1");
  await client.upsertDnsRecord("zone-1", { type: "TXT", name: "example.com", content: "facebook-domain-verification=value" });
  assert.equal(calls.at(-1)?.url.endsWith("/dns_records/record-1"), true);
  assert.equal(calls.at(-1)?.init?.method, "PUT");
});

test("deterministic copy is grammatical and category-aware", () => {
  const client = { id: "client-1", businessName: "Five Star Study", category: "Professional Services", description: "", city: "Lahore", country: "Pakistan", services: ["Education Consulting"], websiteStatus: "not_generated" } as ClientRecord;
  const content = createDeterministicContent(client);
  assert.equal(content.heroHeadline, "Professional services from Five Star Study");
  assert.equal(content.heroHeadline.includes("Services services"), false);
  assert.match(content.about, /Five Star Study offers professional services in Lahore, Pakistan/);
  assert.equal(selectTemplateForCategory("consulting"), "professional_corporate");
  assert.equal(selectTemplateForCategory("education"), "local_service");
});

test("public policy paths resolve and unknown paths do not", () => {
  assert.equal(resolvePublicPath(undefined), "");
  assert.equal(resolvePublicPath(["privacy"]), "privacy");
  assert.equal(resolvePublicPath(["terms"]), "terms");
  assert.equal(resolvePublicPath(["unknown"]), null);
});

test("public DNS TXT answers require an exact normalized value", () => {
  const expected = "facebook-domain-verification=abc123";
  assert.equal(normalizeTxtAnswer('"facebook-domain-" "verification=abc123"'), expected);
  assert.equal(hasExpectedTxtAnswer({ Answer: [{ type: 16, data: `"${expected}"` }] }, expected), true);
  assert.equal(hasExpectedTxtAnswer({ Answer: [{ type: 16, data: '"facebook-domain-verification=other"' }] }, expected), false);
});

test("setup sequence pauses for ownership and zone activation", () => {
  const base = { ownershipStatus: "available_not_owned", cloudflareZoneId: null, nameserverStatus: "not_started", cloudflareZoneStatus: "not_started", customDomainStatus: "not_started", sslStatus: "not_started" } as DomainRecord;
  assert.equal(getNextSetupOperation(null), "check_domain");
  assert.equal(getNextSetupOperation(base), "ownership_required");
  assert.equal(getNextSetupOperation({ ...base, ownershipStatus: "existing_owned_domain" }), "create_zone");
  assert.equal(getNextSetupOperation({ ...base, ownershipStatus: "purchased", cloudflareZoneId: "zone", nameserverStatus: "configured", cloudflareZoneStatus: "pending" }), "check_zone");
  assert.equal(getNextSetupOperation({ ...base, ownershipStatus: "purchased", cloudflareZoneId: "zone", nameserverStatus: "configured", cloudflareZoneStatus: "active" }), "attach_worker");
});