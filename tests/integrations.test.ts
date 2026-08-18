import assert from "node:assert/strict";
import test from "node:test";

import { validateMetaVerification, isValidHostname, normalizeHostname, normalizeRegistrationDomain, splitRegistrationDomain } from "../lib/domains/validation";
import { hasExpectedTxtAnswer, normalizeTxtAnswer } from "../lib/domains/public-dns";
import { getNextSetupOperation } from "../lib/domains/setup-sequence";
import { registerDomainWithReconciliation } from "../lib/domains/purchase";
import { CloudflareClient } from "../lib/integrations/cloudflare";
import { HostingerClient } from "../lib/integrations/hostinger";
import { ProviderRequestError } from "../lib/integrations/http";
import { getProviderStatuses, getRuntimeProviderStatuses } from "../lib/integrations/provider-status";
import { createDeterministicContent, selectTemplateForCategory } from "../lib/websites/configuration";
import { resolvePublicPath } from "../lib/domains/public-path";
import type { ClientRecord } from "../lib/clients/repository";
import { buildPortfolioDomainState, getDomainByClientId, selectPrimaryDomainForClient, type DomainRecord } from "../lib/domains/repository";
import { buildControlCenterRows, getAttentionReason, isLiveDomain } from "../lib/dashboard/control-center";
import { assignExistingOwnedDomain, DomainAssignmentConflict, isSafeUnusedCandidate } from "../lib/domains/assignment";

function makeDomain(overrides: Partial<DomainRecord> = {}): DomainRecord {
  return {
    id: "domain-1", clientId: "client-1", domain: "candidate.example", registrar: "hostinger",
    availabilityStatus: "not_checked", availabilityDetails: null, purchaseStatus: "not_started", ownershipStatus: "available_not_owned", purchasedAt: null,
    cloudflareZoneId: null, cloudflareZoneStatus: "not_started", assignedNameservers: [], nameserverStatus: "not_started", customDomainId: null,
    customDomainStatus: "not_started", wwwCustomDomainId: null, wwwCustomDomainStatus: "not_started", sslStatus: "not_started", metaVerificationValue: null,
    metaDnsRecordId: null, metaVerificationStatus: "not_configured", metaPublicDnsStatus: "not_configured", createdAt: "now", updatedAt: "now", ...overrides,
  };
}

function makeAssignmentDb(rows: DomainRecord[], clientDomain = "") {
  const domains = rows.map((row) => ({ ...row }));
  let preferredDomain = clientDomain;
  const websites = new Map<string, { configuration: Record<string, unknown>; updated: number }>();
  const domainRow = (row: DomainRecord) => ({
    id: row.id, client_id: row.clientId, domain: row.domain, registrar: row.registrar, availability_status: row.availabilityStatus,
    availability_details: row.availabilityDetails, purchase_status: row.purchaseStatus, ownership_status: row.ownershipStatus, purchased_at: row.purchasedAt,
    cloudflare_zone_id: row.cloudflareZoneId, cloudflare_zone_status: row.cloudflareZoneStatus, assigned_nameservers: JSON.stringify(row.assignedNameservers),
    nameserver_status: row.nameserverStatus, custom_domain_id: row.customDomainId, custom_domain_status: row.customDomainStatus,
    www_custom_domain_id: row.wwwCustomDomainId, www_custom_domain_status: row.wwwCustomDomainStatus, ssl_status: row.sslStatus,
    meta_verification_value: row.metaVerificationValue, meta_dns_record_id: row.metaDnsRecordId, meta_verification_status: row.metaVerificationStatus,
    meta_public_dns_status: row.metaPublicDnsStatus, created_at: row.createdAt, updated_at: row.updatedAt,
  });
  const db = {
    prepare(sql: string) {
      let values: unknown[] = [];
      return {
        bind(...bound: unknown[]) { values = bound; return this; },
        async first<T>() {
          if (sql.includes("SELECT client_id FROM domains")) return domains.find((row) => row.domain === values[0]) ? { client_id: domains.find((row) => row.domain === values[0])!.clientId } as T : null;
          if (sql.includes("FROM domains WHERE domain")) { const row = domains.find((item) => item.domain === values[0]); return row ? domainRow(row) as T : null; }
          if (sql.includes("JOIN clients c")) {
            const candidates = domains.filter((row) => row.clientId === values[0]);
            const selected = candidates.find((row) => row.domain === preferredDomain)
              ?? candidates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.domain.localeCompare(right.domain))[0];
            return selected ? domainRow(selected) as T : null;
          }
          if (sql.includes("FROM websites")) return websites.has(values[0] as string) ? { client_id: values[0], generated_configuration: JSON.stringify(websites.get(values[0] as string)!.configuration), status: "draft", selected_template: "modern_business", content_source: "deterministic", reviewed_at: null, id: "website-1", created_at: "now", updated_at: "now" } as T : null;
          return null;
        },
        async all<T>() { return { results: (sql.includes("WHERE client_id") ? domains.filter((row) => row.clientId === values[0]) : domains).map(domainRow) as T[] }; },
        async run() {
          if (sql.startsWith("DELETE FROM domains")) { const index = domains.findIndex((row) => row.id === values[0]); if (index >= 0) domains.splice(index, 1); }
          if (sql.startsWith("INSERT INTO domains")) { const existing = domains.find((row) => row.domain === values[2]); if (!existing) domains.push(makeDomain({ id: values[0] as string, clientId: values[1] as string, domain: values[2] as string })); }
          if (sql.includes("SET ownership_status = 'existing_owned_domain'")) { const row = domains.find((item) => item.domain === values[2] && item.clientId === values[3]); if (row) row.ownershipStatus = "existing_owned_domain"; if (row) row.availabilityStatus = values[0] as string; }
          if (sql.includes("preferred_domain")) preferredDomain = values[0] as string;
          if (sql.includes("generated_configuration")) { const website = websites.get(values.at(-1) as string); if (website) { website.configuration = JSON.parse(values[0] as string); website.updated++; } }
          return { meta: { changes: 1 } };
        },
      };
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) { return Promise.all(statements.map((statement) => statement.run())); },
    get state() { return { domains, preferredDomain, websites }; },
  } as unknown as D1Database & { state: { domains: DomainRecord[]; preferredDomain: string; websites: Map<string, { configuration: Record<string, unknown>; updated: number }> } };
  return db;
}

test("existing owned assignment preserves valid availability, reconciles partial rows, and syncs client and website domain", async () => {
  const db = makeAssignmentDb([makeDomain({ id: "partial", domain: "vibetechsolutions.online", availabilityStatus: "not_checked" })]);
  const originalContent = { heroHeadline: "Keep this business copy" };
  db.state.websites.set("client-1", { configuration: { online: { preferredDomain: "old.example", facebook: "", instagram: "" }, content: originalContent }, updated: 0 });
  const result = await assignExistingOwnedDomain(db, "client-1", "https://WWW.vibetechsolutions.online/", async () => true);
  assert.equal(result.domain.ownershipStatus, "existing_owned_domain");
  assert.ok(["not_checked", "available", "unavailable", "unknown", "failed"].includes(result.domain.availabilityStatus));
  assert.notEqual(result.domain.availabilityStatus, "owned");
  assert.equal(db.state.preferredDomain, "vibetechsolutions.online");
  assert.equal((db.state.websites.get("client-1")!.configuration.online as { preferredDomain: string }).preferredDomain, "vibetechsolutions.online");
  assert.deepEqual(db.state.websites.get("client-1")!.configuration.content, originalContent);
  assert.equal(db.state.websites.get("client-1")!.updated, 1);
});

test("existing owned assignment is idempotent and rejects cross-client claims", async () => {
  const db = makeAssignmentDb([makeDomain({ domain: "owned.example", ownershipStatus: "existing_owned_domain" })]);
  await assignExistingOwnedDomain(db, "client-1", "owned.example", async () => true);
  await assignExistingOwnedDomain(db, "client-1", "owned.example", async () => true);
  assert.equal(db.state.domains.filter((row) => row.domain === "owned.example").length, 1);
  await assert.rejects(() => assignExistingOwnedDomain(db, "client-2", "owned.example", async () => true), DomainAssignmentConflict);
});

test("safe unused candidates replace while configured domains block replacement", async () => {
  assert.equal(isSafeUnusedCandidate(makeDomain()), true);
  assert.equal(isSafeUnusedCandidate(makeDomain({ cloudflareZoneId: "zone" })), false);
  const safeDb = makeAssignmentDb([makeDomain({ domain: "candidate.example" })]);
  const assigned = await assignExistingOwnedDomain(safeDb, "client-1", "owned.example", async (domain) => domain === "owned.example");
  assert.deepEqual(assigned.replacedDomains, ["candidate.example"]);
  assert.deepEqual(safeDb.state.domains.map((row) => row.domain), ["owned.example"]);
  const configuredDb = makeAssignmentDb([makeDomain({ domain: "live.example", cloudflareZoneId: "zone" })]);
  await assert.rejects(() => assignExistingOwnedDomain(configuredDb, "client-1", "owned.example", async () => true), /configured domain live\.example/);
  assert.equal(configuredDb.state.domains[0].domain, "live.example");
});

test("preferred domain wins duplicate rows in repository and dashboard regardless of list order", async () => {
  const preferred = makeDomain({ id: "preferred", domain: "primary.example", updatedAt: "2026-01-01T00:00:00.000Z", ownershipStatus: "existing_owned_domain" });
  const newer = makeDomain({ id: "newer", domain: "candidate.example", updatedAt: "2026-02-01T00:00:00.000Z", ownershipStatus: "purchase_pending", purchaseStatus: "pending" });
  const db = makeAssignmentDb([newer, preferred], "primary.example");
  assert.equal((await getDomainByClientId(db, "client-1"))?.id, "preferred");
  const client = { id: "client-1", domain: "primary.example", businessName: "Example", websiteStatus: "draft" } as unknown as ClientRecord;
  assert.equal(selectPrimaryDomainForClient(client, [newer, preferred])?.id, "preferred");
  assert.equal(selectPrimaryDomainForClient(client, [preferred, newer])?.id, "preferred");
  assert.equal(buildControlCenterRows([client], [newer, preferred], [])[0].domain?.id, "preferred");
  assert.equal(buildControlCenterRows([client], [preferred, newer], [])[0].nextOperation, "create_zone");
});

test("primary fallback is deterministic when preferred domain is empty", () => {
  const first = makeDomain({ id: "z-id", domain: "a.example", updatedAt: "2026-01-01T00:00:00.000Z" });
  const second = makeDomain({ id: "a-id", domain: "b.example", updatedAt: "2026-01-01T00:00:00.000Z" });
  const client = { id: "client-1", domain: "" };
  assert.equal(selectPrimaryDomainForClient(client, [second, first])?.domain, "a.example");
  assert.equal(selectPrimaryDomainForClient(client, [first, second])?.domain, "a.example");
});

test("pending purchase intent can retire, while purchased, configured, and Hostinger-owned candidates block", async () => {
  const pending = makeDomain({ domain: "pending.example", purchaseStatus: "pending", ownershipStatus: "purchase_pending" });
  assert.equal(isSafeUnusedCandidate(pending), true);
  const pendingDb = makeAssignmentDb([pending]);
  await assignExistingOwnedDomain(pendingDb, "client-1", "owned.example", async (domain) => domain === "owned.example");
  assert.deepEqual(pendingDb.state.domains.map((row) => row.domain), ["owned.example"]);

  for (const blocked of [
    makeDomain({ domain: "purchased.example", purchaseStatus: "purchased", ownershipStatus: "purchased", purchasedAt: "2026-01-01" }),
    makeDomain({ domain: "configured.example", cloudflareZoneId: "zone-1" }),
  ]) {
    const db = makeAssignmentDb([blocked]);
    await assert.rejects(() => assignExistingOwnedDomain(db, "client-1", "owned.example", async (domain) => domain === "owned.example"), /purchased or configured/);
    assert.equal(db.state.domains.length, 1);
  }

  const hostingerOwnedDb = makeAssignmentDb([pending]);
  await assert.rejects(() => assignExistingOwnedDomain(hostingerOwnedDb, "client-1", "owned.example", async () => true), /already owns competing domain/);
  assert.equal(hostingerOwnedDb.state.domains[0].domain, "pending.example");
});

test("portfolio state marks only the preferred domain as actively assigned", () => {
  const primary = makeDomain({ domain: "primary.example", ownershipStatus: "existing_owned_domain" });
  const historical = makeDomain({ id: "history", domain: "history.example", ownershipStatus: "purchase_pending", purchaseStatus: "pending" });
  const rows = buildPortfolioDomainState(
    ["primary.example", "history.example", "untracked.example"],
    [{ id: "client-1", domain: "primary.example" }],
    [historical, primary],
  );
  assert.deepEqual(rows.map(({ domain, assignedClientId, isPrimary }) => ({ domain, assignedClientId, isPrimary })), [
    { domain: "primary.example", assignedClientId: "client-1", isPrimary: true },
    { domain: "history.example", assignedClientId: null, isPrimary: false },
    { domain: "untracked.example", assignedClientId: null, isPrimary: false },
  ]);
  assert.equal(rows[0].ownershipStatus, "existing_owned_domain");
});

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
    if (String(url).endsWith("/availability")) return Response.json([{ domain: "example.com", is_available: true, price: "12.99", currency: "USD" }]);
    return Response.json({ id: "order-1" });
  };
  const client = new HostingerClient({ token: "test-token", fetch: mockedFetch });
  const availability = await client.checkAvailability("example.com");
  assert.equal(availability[0].availability, "available");
  assert.equal(availability[0].price, 12.99);
  await client.registerDomain({ domain: "example.com", itemId: "item", paymentMethodId: "payment", whoisId: 1 });
  assert.equal(calls[1].url.endsWith("/api/domains/v1/portfolio"), true);
  assert.equal(calls[1].init?.method, "POST");
});

test("Hostinger handles wrapped pricing, portfolio lookup, WHOIS, and nameservers", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const mockedFetch: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/availability")) return Response.json({ data: [{ domain: "example.com", is_available: true, price: "9.50", currency: "USD" }] });
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

test("availability parsing fails safe and normalization preserves the intended domain", async () => {
  assert.equal(normalizeRegistrationDomain(" https://WWW.Example.COM/path/ "), "example.com");
  assert.deepEqual(splitRegistrationDomain("Example.COM"), { domain: "example", tld: "com" });
  const responses = [
    [{ domain: "available.example", is_available: true }],
    [{ domain: "taken.example", is_available: false }],
    [{ domain: "unknown.example" }],
  ];
  for (const expected of ["available", "unavailable", "unknown"] as const) {
    const client = new HostingerClient({ token: "test-token", fetch: async () => Response.json(responses.shift()) });
    assert.equal((await client.checkAvailability(`${expected}.example`))[0].availability, expected);
  }
  const errorClient = new HostingerClient({ token: "test-token", fetch: async () => Response.json({ error: "upstream" }, { status: 500 }) });
  await assert.rejects(() => errorClient.checkAvailability("error.example"), ProviderRequestError);
});

test("paid registration reconciles portfolio ownership before any write", async () => {
  const methods: string[] = [];
  const client = new HostingerClient({ token: "test-token", fetch: async (_url, init) => {
    methods.push(init?.method ?? "GET");
    return Response.json({ items: [{ domain: "example.com", status: "active" }] });
  } });
  const result = await registerDomainWithReconciliation(client, { domain: "example.com", itemId: "item", paymentMethodId: "payment", whoisId: 1 });
  assert.equal(result.reconciled, true);
  assert.deepEqual(methods, ["GET"]);
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
  const base = { ownershipStatus: "available_not_owned", cloudflareZoneId: null, nameserverStatus: "not_started", cloudflareZoneStatus: "not_started", customDomainStatus: "not_started", wwwCustomDomainStatus: "not_started", sslStatus: "not_started" } as DomainRecord;
  assert.equal(getNextSetupOperation(null), "check_domain");
  assert.equal(getNextSetupOperation(base), "ownership_required");
  assert.equal(getNextSetupOperation({ ...base, ownershipStatus: "existing_owned_domain" }), "create_zone");
  assert.equal(getNextSetupOperation({ ...base, ownershipStatus: "purchased", cloudflareZoneId: "zone", nameserverStatus: "configured", cloudflareZoneStatus: "pending" }), "check_zone");
  assert.equal(getNextSetupOperation({ ...base, ownershipStatus: "purchased", cloudflareZoneId: "zone", nameserverStatus: "configured", cloudflareZoneStatus: "active" }), "attach_worker");
  assert.equal(getNextSetupOperation({ ...base, ownershipStatus: "purchased", cloudflareZoneId: "zone", nameserverStatus: "configured", cloudflareZoneStatus: "active", customDomainId: "worker-domain", wwwCustomDomainId: "www-worker-domain", customDomainStatus: "pending" }), "check_worker");
  assert.equal(getNextSetupOperation({ ...base, ownershipStatus: "purchased", cloudflareZoneId: "zone", nameserverStatus: "configured", cloudflareZoneStatus: "active", customDomainId: "worker-domain", wwwCustomDomainId: "www-worker-domain", customDomainStatus: "active", wwwCustomDomainStatus: "active" }), "check_https");
});

test("control center derives attention and live apex/www status", () => {
  const base = { clientId: "client-1", ownershipStatus: "purchased", cloudflareZoneId: "zone", cloudflareZoneStatus: "active", nameserverStatus: "configured", customDomainId: "apex", customDomainStatus: "active", wwwCustomDomainId: "www", wwwCustomDomainStatus: "active", sslStatus: "ready" } as DomainRecord;
  assert.equal(isLiveDomain(base), true);
  assert.equal(getAttentionReason({ ...base, sslStatus: "failed" }, null), "https_failed");
  assert.equal(getAttentionReason({ ...base, ownershipStatus: "available_not_owned" }, null), "ownership_action");
  const client = { id: "client-1", websiteStatus: "ready", businessName: "Example", domain: "example.com" } as unknown as ClientRecord;
  const rows = buildControlCenterRows([client], [{ ...base, id: "domain-1" }], []);
  assert.equal(rows[0].nextOperation, "complete");
  assert.equal(rows[0].attention, null);
});