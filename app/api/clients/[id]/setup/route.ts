import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getClientById } from "@/lib/clients/repository";
import { getDomainByClientId, updateDomainFields, upsertDomain } from "@/lib/domains/repository";
import { isValidHostname, normalizeHostname, validateMetaVerification } from "@/lib/domains/validation";
import { CloudflareClient } from "@/lib/integrations/cloudflare";
import { HostingerClient } from "@/lib/integrations/hostinger";
import { ProviderRequestError } from "@/lib/integrations/http";
import { recordIntegrationRun, type IntegrationProvider } from "@/lib/integrations/repository";

type SetupBody = { operation?: string; domain?: string; value?: string; confirmation?: string; confirmationToken?: string; secondConfirmation?: boolean; itemId?: string; paymentMethodId?: string; whoisId?: number };
function object(value: unknown) { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function safeError(error: unknown) { return error instanceof ProviderRequestError ? `${error.details.message}${error.details.code ? ` (${error.details.code})` : ""}` : error instanceof Error ? error.message.slice(0, 300) : "Provider operation failed."; }

export async function POST(request: Request, context: RouteContext<"/api/clients/[id]/setup">) {
  const { id } = await context.params; const body = await request.json().catch(() => null) as SetupBody | null;
  const { env } = getCloudflareContext(); const client = await getClientById(env.DB, id);
  if (!client) return Response.json({ error: "Client not found." }, { status: 404 });
  const variables = env as unknown as Record<string, string | undefined>;
  const hostinger = new HostingerClient({ token: variables.HOSTINGER_API_TOKEN });
  const cloudflare = new CloudflareClient({ token: variables.CLOUDFLARE_API_TOKEN, accountId: variables.CLOUDFLARE_ACCOUNT_ID, workerName: variables.CLOUDFLARE_WORKER_NAME });
  let provider: IntegrationProvider = body?.operation === "check_domain" || body?.operation?.includes("purchase") || body?.operation === "update_nameservers" ? "hostinger" : "cloudflare";
  const operation = body?.operation ?? "unknown";
  try {
    if (operation === "check_domain") {
      const hostname = normalizeHostname(body?.domain ?? client.domain); if (!isValidHostname(hostname)) return Response.json({ error: "A valid preferred domain is required." }, { status: 422 });
      if (!hostinger.isConfigured()) throw new Error("Hostinger is not configured.");
      const results = await hostinger.checkAvailability(hostname); const found = results.find((item) => item.domain === hostname) ?? results[0];
      const domain = await upsertDomain(env.DB, id, hostname); await updateDomainFields(env.DB, domain!.id, { availability_status: found?.available ? "available" : "unavailable", availability_details: JSON.stringify(found ? { domain: found.domain, available: found.available, price: found.price, currency: found.currency } : {}), availability_checked_at: new Date().toISOString() });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Availability checked for ${hostname}.` });
      return Response.json({ message: found?.available ? `Available${found.price !== null ? `: ${found.price} ${found.currency ?? ""}` : ""}` : "Domain is unavailable.", availability: found ? { available: found.available, price: found.price, currency: found.currency } : null });
    }
    const domain = await getDomainByClientId(env.DB, id); if (!domain) return Response.json({ error: "Check the preferred domain first." }, { status: 409 });
    if (operation === "list_whois") {
      if (!hostinger.isConfigured()) throw new Error("Hostinger is not configured.");
      const profiles = await hostinger.listWhoisProfiles();
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: "WHOIS profiles loaded." });
      return Response.json({ message: "WHOIS profiles loaded.", profiles });
    }
    if (operation === "portfolio_lookup") {
      if (!hostinger.isConfigured()) throw new Error("Hostinger is not configured.");
      const portfolioDomain = await hostinger.findPortfolioDomain(domain.domain);
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Portfolio lookup completed for ${domain.domain}.` });
      return Response.json({ message: portfolioDomain ? "Domain found in Hostinger portfolio." : "Domain is not present in the Hostinger portfolio.", found: Boolean(portfolioDomain), domain: portfolioDomain });
    }
    if (operation === "confirm_purchase") {
      if (body?.confirmation !== domain.domain) return Response.json({ error: "Type the exact domain name for the first purchase confirmation." }, { status: 422 });
      if (domain.availabilityStatus !== "available") return Response.json({ error: "Only an available domain can proceed to purchase confirmation." }, { status: 409 });
      const token = crypto.randomUUID(); await updateDomainFields(env.DB, domain.id, { purchase_confirmation_token: token, purchase_status: "pending" });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "pending", safeMessage: "First paid domain purchase confirmation accepted; no purchase made." });
      return Response.json({ message: "First confirmation accepted. Review cost and submit the second explicit confirmation.", confirmationToken: token });
    }
    if (operation === "purchase_domain") {
      const row = await env.DB.prepare("SELECT purchase_confirmation_token FROM domains WHERE id = ?").bind(domain.id).first<{ purchase_confirmation_token: string | null }>();
      if (!body?.secondConfirmation || !body.confirmationToken || body.confirmationToken !== row?.purchase_confirmation_token) return Response.json({ error: "A valid second explicit purchase confirmation is required." }, { status: 422 });
      if (!body.itemId || !body.paymentMethodId || !Number.isInteger(body.whoisId)) return Response.json({ error: "itemId, paymentMethodId, and whoisId are required." }, { status: 422 });
      if (!hostinger.isConfigured()) throw new Error("Hostinger is not configured.");
      await hostinger.registerDomain({ domain: domain.domain, itemId: body.itemId, paymentMethodId: body.paymentMethodId, whoisId: body.whoisId! });
      await updateDomainFields(env.DB, domain.id, { purchase_status: "purchased", purchase_confirmation_token: null, purchased_at: new Date().toISOString() });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Domain registration submitted for ${domain.domain}.` });
      return Response.json({ message: "Domain registration request submitted." });
    }
    if (operation === "create_zone") {
      if (!cloudflare.isConfigured()) throw new Error("Cloudflare is not configured.");
      const existing = object(await cloudflare.findZone(domain.domain)); const zone = existing.id ? existing : object(await cloudflare.createZone(domain.domain));
      if (typeof zone.id !== "string") throw new Error("Cloudflare did not return a zone ID.");
      const nameservers = Array.isArray(zone.name_servers) ? zone.name_servers.filter((item): item is string => typeof item === "string") : [];
      await updateDomainFields(env.DB, domain.id, { cloudflare_zone_id: zone.id, cloudflare_zone_status: typeof zone.status === "string" ? zone.status : "pending", assigned_nameservers: JSON.stringify(nameservers) });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Cloudflare zone ready for ${domain.domain}.` }); return Response.json({ message: "Cloudflare zone created or found.", nameservers });
    }
    if (operation === "update_nameservers") {
      provider = "hostinger"; if (!hostinger.isConfigured()) throw new Error("Hostinger is not configured."); if (domain.assignedNameservers.length < 2) return Response.json({ error: "Cloudflare nameservers are not available." }, { status: 409 });
      await hostinger.updateNameservers(domain.domain, domain.assignedNameservers); await updateDomainFields(env.DB, domain.id, { nameserver_status: "configured" });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Nameserver update submitted for ${domain.domain}.` }); return Response.json({ message: "Nameserver update submitted." });
    }
    if (operation === "attach_worker") {
      if (!cloudflare.isConfigured()) throw new Error("Cloudflare is not configured."); const attached = object(await cloudflare.attachWorkerDomain(domain.domain));
      await updateDomainFields(env.DB, domain.id, { custom_domain_id: typeof attached.id === "string" ? attached.id : null, custom_domain_status: typeof attached.status === "string" ? attached.status : "pending" });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Shared Worker custom domain submitted for ${domain.domain}.` }); return Response.json({ message: "Worker custom domain attachment submitted." });
    }
    if (operation === "check_https") {
      provider = "cloudflare"; const response = await fetch(`https://${domain.domain}/`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) }); const ready = response.ok;
      await updateDomainFields(env.DB, domain.id, { ssl_status: ready ? "ready" : "pending", https_checked_at: new Date().toISOString(), ...(ready ? { custom_domain_status: "active" } : {}) });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: ready ? "success" : "pending", safeMessage: `HTTPS check returned HTTP ${response.status} for ${domain.domain}.` }); return Response.json({ message: `HTTPS returned HTTP ${response.status}.`, ready });
    }
    if (operation === "create_meta_txt") {
      const validation = validateMetaVerification(body?.value ?? ""); if (!validation.valid) return Response.json({ error: validation.error }, { status: 422 });
      if (!cloudflare.isConfigured()) throw new Error("Cloudflare is not configured."); if (!domain.cloudflareZoneId) return Response.json({ error: "Create the Cloudflare zone first." }, { status: 409 });
      const record = object(await cloudflare.upsertDnsRecord(domain.cloudflareZoneId, { type: "TXT", name: domain.domain, content: validation.value }));
      await updateDomainFields(env.DB, domain.id, { meta_verification_value: validation.value, meta_dns_record_id: typeof record.id === "string" ? record.id : null, meta_verification_status: "record_created" });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Meta TXT record created for ${domain.domain}; Meta verification not claimed.` }); return Response.json({ message: "TXT record created. DNS is pending; Meta approval is not yet confirmed." });
    }
    if (operation === "check_meta_txt") {
      if (!cloudflare.isConfigured()) throw new Error("Cloudflare is not configured."); if (!domain.cloudflareZoneId || !domain.metaVerificationValue) return Response.json({ error: "Meta TXT is not configured." }, { status: 409 });
      const records = await cloudflare.listDnsRecords(domain.cloudflareZoneId, "TXT", domain.domain); const detected = Array.isArray(records) && records.some((item) => object(item).content === domain.metaVerificationValue);
      await updateDomainFields(env.DB, domain.id, { meta_verification_status: detected ? "dns_detected" : "record_created" }); await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: detected ? "success" : "pending", safeMessage: detected ? "Meta TXT detected in Cloudflare DNS; Meta approval not claimed." : "Meta TXT remains pending in DNS." }); return Response.json({ message: detected ? "DNS detected. Ready to verify in Meta." : "DNS is still pending.", detected });
    }
    return Response.json({ error: "Unsupported setup operation." }, { status: 422 });
  } catch (error) {
    const message = safeError(error); await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "failed", safeMessage: message });
    return Response.json({ error: message }, { status: /not configured/i.test(message) ? 503 : 502 });
  }
}