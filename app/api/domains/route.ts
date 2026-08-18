import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listDomains, upsertDomain, updateDomainFields } from "@/lib/domains/repository";
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
      const results = (await Promise.all(candidates.map(async (domain) => (await client.checkAvailability(domain))[0]))).filter(Boolean);
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
  const body = await request.json().catch(() => null) as { domain?: string; clientId?: string } | null;
  if (!body?.domain || !body.clientId) return Response.json({ error: "A client and exact domain are required." }, { status: 422 });
  const { env } = getCloudflareContext();
  const client = new HostingerClient({ token: (env as unknown as Record<string, string | undefined>).HOSTINGER_API_TOKEN });
  try {
    const portfolioDomain = await client.findPortfolioDomain(body.domain);
    if (!portfolioDomain) return Response.json({ error: "Hostinger did not confirm ownership of this domain." }, { status: 409 });
    const domain = await upsertDomain(env.DB, body.clientId, body.domain);
    await updateDomainFields(env.DB, domain.id, { ownership_status: "existing_owned_domain", availability_status: "owned" });
    return Response.json({ message: "Domain assigned. Continue setup to configure Cloudflare and the shared Worker." });
  } catch (error) {
    return Response.json({ error: safeError(error) }, { status: 409 });
  }
}