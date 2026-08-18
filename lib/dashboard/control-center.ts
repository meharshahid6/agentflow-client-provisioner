import type { ClientRecord } from "@/lib/clients/repository";
import type { DomainRecord } from "@/lib/domains/repository";
import type { WebsiteRecord } from "@/lib/websites/repository";
import { getNextSetupOperation, type SetupOperation } from "@/lib/domains/setup-sequence";

export type AttentionReason = "provider_failure" | "setup_failed" | "zone_issue" | "https_failed" | "ownership_action" | "publication_inconsistency";

export type ControlCenterRow = {
  client: ClientRecord;
  domain: DomainRecord | null;
  website: WebsiteRecord | null;
  nextOperation: SetupOperation;
  attention: AttentionReason | null;
};

export function getAttentionReason(domain: DomainRecord | null, website: WebsiteRecord | null): AttentionReason | null {
  if (!domain && website?.status === "published") return "publication_inconsistency";
  if (domain?.availabilityStatus === "failed" || domain?.purchaseStatus === "failed") return "provider_failure";
  if ([domain?.cloudflareZoneStatus, domain?.customDomainStatus, domain?.wwwCustomDomainStatus, domain?.sslStatus].includes("failed")) {
    if (domain?.cloudflareZoneStatus === "failed") return "zone_issue";
    if (domain?.sslStatus === "failed") return "https_failed";
    return "setup_failed";
  }
  if (domain && domain.ownershipStatus === "available_not_owned") return "ownership_action";
  if (website?.status === "published" && domain && domain.sslStatus !== "ready") return "publication_inconsistency";
  return null;
}

export function buildControlCenterRows(clients: ClientRecord[], domains: DomainRecord[], websites: WebsiteRecord[]): ControlCenterRow[] {
  const domainsByClient = new Map(domains.map((domain) => [domain.clientId, domain]));
  const websitesByClient = new Map(websites.map((website) => [website.clientId, website]));
  return clients.map((client) => {
    const domain = domainsByClient.get(client.id) ?? null;
    const website = websitesByClient.get(client.id) ?? null;
    return { client, domain, website, nextOperation: getNextSetupOperation(domain), attention: getAttentionReason(domain, website) };
  });
}

export function isLiveDomain(domain: DomainRecord | null) {
  return Boolean(domain?.customDomainStatus === "active" && domain.wwwCustomDomainStatus === "active" && domain.sslStatus === "ready");
}