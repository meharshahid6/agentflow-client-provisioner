import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getClientById } from "@/lib/clients/repository";
import { assignExistingOwnedDomain, inspectExistingOwnedDomainAssignment } from "@/lib/domains/assignment";
import { listDomains } from "@/lib/domains/repository";
import { getNextSetupOperation } from "@/lib/domains/setup-sequence";
import { HostingerClient } from "@/lib/integrations/hostinger";
import { ProviderRequestError } from "@/lib/integrations/http";

export const dynamic = "force-dynamic";

function safeError(error: unknown) {
  return error instanceof ProviderRequestError ? error.details.message : error instanceof Error ? error.message.slice(0, 240) : "Hostinger is unavailable.";
}

function portfolioRows(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  return [record.data, record.result, record.items].find(Array.isArray) ?? [];
}

function portfolioName(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const name = [row.domain, row.name, row.hostname].find((item) => typeof item === "string");
  return typeof name === "string" ? name.toLowerCase() : null;
}

function suggestions(term: string) {
  const normalized = term.trim().toLowerCase();
  if (normalized.includes(".")) return [normalized];
  const cleaned = normalized.replace(/[^a-z0-9]+/g, "");
  if (!cleaned) return [];
  return [`${cleaned}.com`, `${cleaned}.net`, `the${cleaned}.com`, `${cleaned}.co`, `${cleaned}.org`];
}

export async function GET(request: Request) {
  const { env } = getCloudflareContext();
  const token = (env as unknown as Record<string, string | undefined>).HOSTINGER_API_TOKEN;
  const client = new HostingerClient({ token });
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "portfolio";
  try {
    if (mode === "search") {
      const candidates = [...new Set(suggestions(url.searchParams.get("query") ?? ""))].slice(0, 10);
      const results = (await Promise.all(candidates.map(async (domain) => {
        try { return (await client.checkAvailability(domain))[0]; }
        catch { return { domain, availability: "unknown" as const, price: null, currency: null, raw: null }; }
      }))).filter(Boolean);
      return Response.json({ results });
    }
    const rows = portfolioRows(await client.listPortfolio());
    const domains = await listDomains(env.DB);
    const assignments = new Map(domains.map((domain) => [domain.domain, domain.clientId]));
    return Response.json({ domains: rows.map((row) => ({ domain: portfolioName(row), assignedClientId: assignments.get(portfolioName(row) ?? "") ?? null })).filter((row) => row.domain) });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: /not configured/i.test(safeError(error)) ? 503 : 502 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { domain?: string; clientId?: string; preview?: boolean } | null;
  if (!body?.domain || !body.clientId) return Response.json({ error: "A client and exact domain are required." }, { status: 422 });
  const { env } = getCloudflareContext();
  const client = new HostingerClient({ token: (env as unknown as Record<string, string | undefined>).HOSTINGER_API_TOKEN });
  try {
    const selectedClient = await getClientById(env.DB, body.clientId);
    if (!selectedClient) return Response.json({ error: "Client not found." }, { status: 404 });
    const inspection = await inspectExistingOwnedDomainAssignment(env.DB, body.clientId, body.domain);
    if (body.preview) return Response.json({ domain: inspection.domain, clientName: selectedClient.businessName, replaceableDomains: inspection.replaceableDomains });
    const result = await assignExistingOwnedDomain(env.DB, body.clientId, body.domain, async (domain) => Boolean(await client.findPortfolioDomain(domain)));
    return Response.json({
      message: "Domain assigned successfully. Ownership confirmed through Hostinger. No DNS changes have been made yet. Next step: Create Cloudflare Zone.",
      domain: result.domain.domain,
      ownershipStatus: result.domain.ownershipStatus,
      availabilityStatus: result.domain.availabilityStatus,
      nextOperation: getNextSetupOperation(result.domain),
      replacedDomains: result.replacedDomains,
    });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 409 });
  }
}