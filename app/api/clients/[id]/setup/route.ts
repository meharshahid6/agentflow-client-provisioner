import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getClientById } from "@/lib/clients/repository";
import { getDomainByClientId, updateDomainFields, upsertDomain } from "@/lib/domains/repository";
import { isValidHostname, normalizeHostname, validateMetaVerification } from "@/lib/domains/validation";
import { checkPublicTxt } from "@/lib/domains/public-dns";
import { registerDomainWithReconciliation } from "@/lib/domains/purchase";
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
      const [results, portfolioDomain] = await Promise.all([hostinger.checkAvailability(hostname), hostinger.findPortfolioDomain(hostname)]); const found = results.find((item) => item.domain === hostname) ?? results[0];
      const domain = await upsertDomain(env.DB, id, hostname); await updateDomainFields(env.DB, domain!.id, { availability_status: found?.availability ?? "unknown", availability_details: JSON.stringify(found ? { domain: found.domain, availability: found.availability, price: found.price, currency: found.currency } : {}), availability_checked_at: new Date().toISOString(), ownership_status: portfolioDomain ? "existing_owned_domain" : "available_not_owned" });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Availability checked for ${hostname}.` });
      return Response.json({ message: found?.availability === "available" ? `Available${found.price !== null ? `: ${found.price} ${found.currency ?? ""}` : ""}` : found?.availability === "unavailable" ? "Domain is unavailable." : "Could not verify availability.", availability: found ? { status: found.availability, price: found.price, currency: found.currency } : null });
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
      if (portfolioDomain) await updateDomainFields(env.DB, domain.id, { ownership_status: "existing_owned_domain" });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Portfolio lookup completed for ${domain.domain}.` });
      return Response.json({ message: portfolioDomain ? "Domain found in Hostinger portfolio." : "Domain is not present in the Hostinger portfolio.", found: Boolean(portfolioDomain), domain: portfolioDomain });
    }
    if (operation === "confirm_purchase") {
      if (body?.confirmation !== domain.domain) return Response.json({ error: "Type the exact domain name for the first purchase confirmation." }, { status: 422 });
      if (domain.availabilityStatus !== "available") return Response.json({ error: "Only an available domain can proceed to purchase confirmation." }, { status: 409 });
      const token = crypto.randomUUID(); await updateDomainFields(env.DB, domain.id, { purchase_confirmation_token: token, purchase_status: "pending", ownership_status: "purchase_pending" });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "pending", safeMessage: "First paid domain purchase confirmation accepted; no purchase made." });
      return Response.json({ message: "First confirmation accepted. Review cost and submit the second explicit confirmation.", confirmationToken: token });
    }
    if (operation === "purchase_domain") {
      const row = await env.DB.prepare("SELECT purchase_confirmation_token FROM domains WHERE id = ?").bind(domain.id).first<{ purchase_confirmation_token: string | null }>();
      if (!body?.secondConfirmation || !body.confirmationToken || body.confirmationToken !== row?.purchase_confirmation_token) return Response.json({ error: "A valid second explicit purchase confirmation is required." }, { status: 422 });
      if (!body.itemId || !body.paymentMethodId || !Number.isInteger(body.whoisId)) return Response.json({ error: "itemId, paymentMethodId, and whoisId are required." }, { status: 422 });
      if (!hostinger.isConfigured()) throw new Error("Hostinger is not configured.");
      const purchase = await registerDomainWithReconciliation(hostinger, { domain: domain.domain, itemId: body.itemId, paymentMethodId: body.paymentMethodId, whoisId: body.whoisId! });
      if (purchase.reconciled) {
        await updateDomainFields(env.DB, domain.id, { purchase_status: "purchased", ownership_status: "purchased", purchase_confirmation_token: null, purchased_at: domain.purchasedAt ?? new Date().toISOString() });
        await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Portfolio reconciliation confirmed ownership of ${domain.domain}; no second registration was submitted.` });
        return Response.json({ message: "Domain ownership was found in Hostinger. No second registration was submitted.", reconciled: true });
      }
      await updateDomainFields(env.DB, domain.id, { purchase_status: "purchased", ownership_status: "purchased", purchase_confirmation_token: null, purchased_at: new Date().toISOString() });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Domain registration submitted for ${domain.domain}.` });
      return Response.json({ message: "Domain registration request submitted." });
    }
    if (operation === "create_zone") {
    if (!(["existing_owned_domain", "purchased"] as string[]).includes(domain.ownershipStatus)) throw new Error("Domain ownership must be confirmed before creating a Cloudflare zone.");
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
    if (operation === "check_zone") {
      if (!cloudflare.isConfigured()) throw new Error("Cloudflare is not configured."); if (!domain.cloudflareZoneId) return Response.json({ error: "Create the Cloudflare zone first." }, { status: 409 });
      const zone = object(await cloudflare.getZone(domain.cloudflareZoneId)); const status = zone.status === "active" ? "active" : "pending";
      await updateDomainFields(env.DB, domain.id, { cloudflare_zone_status: status });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: status === "active" ? "success" : "pending", safeMessage: `Cloudflare zone is ${status}.` });
      return Response.json({ message: status === "active" ? "Cloudflare zone is active." : "Cloudflare zone is still pending activation.", status });
    }
    if (operation === "attach_worker") {
      if (domain.cloudflareZoneStatus !== "active") return Response.json({ error: "Cloudflare zone must be active before attaching the Worker custom domain." }, { status: 409 });
      if (!cloudflare.isConfigured()) throw new Error("Cloudflare is not configured.");
      const [apex, www] = await Promise.all([cloudflare.attachWorkerDomain(domain.domain), cloudflare.attachWorkerDomain(`www.${domain.domain}`)]).then((items) => items.map(object));
      if (typeof apex.id !== "string" || typeof www.id !== "string") throw new Error("Cloudflare did not return both Worker custom-domain IDs.");
      await updateDomainFields(env.DB, domain.id, { custom_domain_id: apex.id, custom_domain_status: typeof apex.status === "string" ? apex.status : "pending", www_custom_domain_id: www.id, www_custom_domain_status: typeof www.status === "string" ? www.status : "pending" });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Shared Worker custom domains submitted for ${domain.domain} and www.${domain.domain}.` }); return Response.json({ message: "Apex and www Worker custom-domain attachments submitted." });
    }
    if (operation === "check_worker") {
      if (!cloudflare.isConfigured()) throw new Error("Cloudflare is not configured.");
      if (!domain.customDomainId || !domain.wwwCustomDomainId) return Response.json({ error: "Attach both Worker custom domains first." }, { status: 409 });
      const [apex, www] = await Promise.all([cloudflare.getWorkerDomain(domain.customDomainId), cloudflare.getWorkerDomain(domain.wwwCustomDomainId)]).then((items) => items.map(object));
      const apexStatus = apex.status === "active" ? "active" : "pending";
      const wwwStatus = www.status === "active" ? "active" : "pending";
      const active = apexStatus === "active" && wwwStatus === "active";
      await updateDomainFields(env.DB, domain.id, { custom_domain_status: apexStatus, www_custom_domain_status: wwwStatus });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: active ? "success" : "pending", safeMessage: `Worker domains: apex ${apexStatus}, www ${wwwStatus}.` });
      return Response.json({ message: active ? "Apex and www Worker custom domains are active." : "One or more Worker custom domains are still pending.", status: active ? "active" : "pending" });
    }
    if (operation === "check_https") {
      if (domain.customDomainStatus !== "active" || domain.wwwCustomDomainStatus !== "active") return Response.json({ error: "Apex and www Worker custom domains must be active before checking HTTPS." }, { status: 409 });
      provider = "cloudflare"; const [apex, www] = await Promise.all([domain.domain, `www.${domain.domain}`].map((hostname) => fetch(`https://${hostname}/`, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) })));
      const ready = apex.ok && www.ok;
      await updateDomainFields(env.DB, domain.id, { ssl_status: ready ? "ready" : "pending", https_checked_at: new Date().toISOString() });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: ready ? "success" : "pending", safeMessage: `HTTPS checks returned apex ${apex.status}, www ${www.status}.` }); return Response.json({ message: `HTTPS returned apex HTTP ${apex.status}, www HTTP ${www.status}.`, ready });
    }
    if (operation === "create_meta_txt") {
      const validation = validateMetaVerification(body?.value ?? ""); if (!validation.valid) return Response.json({ error: validation.error }, { status: 422 });
      if (!cloudflare.isConfigured()) throw new Error("Cloudflare is not configured."); if (!domain.cloudflareZoneId) return Response.json({ error: "Create the Cloudflare zone first." }, { status: 409 });
      const record = object(await cloudflare.upsertDnsRecord(domain.cloudflareZoneId, { type: "TXT", name: domain.domain, content: validation.value }));
      await updateDomainFields(env.DB, domain.id, { meta_verification_value: validation.value, meta_dns_record_id: typeof record.id === "string" ? record.id : null, meta_verification_status: "record_created", meta_public_dns_status: "dns_pending", meta_public_dns_checked_at: null });
      await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "success", safeMessage: `Meta TXT record created for ${domain.domain}; Meta verification not claimed.` }); return Response.json({ message: "TXT record created. DNS is pending; Meta approval is not yet confirmed." });
    }
    if (operation === "check_meta_txt") {
      provider = "system"; if (!domain.metaVerificationValue) return Response.json({ error: "Meta TXT is not configured." }, { status: 409 });
      const detected = await checkPublicTxt(domain.domain, domain.metaVerificationValue);
      await updateDomainFields(env.DB, domain.id, { meta_public_dns_status: detected ? "dns_detected" : "dns_pending", meta_public_dns_checked_at: new Date().toISOString() }); await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: detected ? "success" : "pending", safeMessage: detected ? "Public Meta TXT detected; Meta approval not claimed." : "Public Meta TXT remains pending." }); return Response.json({ message: detected ? "DNS detected. Ready to verify in Meta." : "DNS is still pending.", detected });
    }
    return Response.json({ error: "Unsupported setup operation." }, { status: 422 });
  } catch (error) {
    const message = safeError(error); await recordIntegrationRun(env.DB, { clientId: id, provider, operation, status: "failed", safeMessage: message });
    return Response.json({ error: message }, { status: /not configured/i.test(message) ? 503 : 502 });
  }
}