import type { DomainRecord } from "./repository";

export type SetupOperation = "check_domain" | "ownership_required" | "create_zone" | "update_nameservers" | "check_zone" | "attach_worker" | "check_https" | "complete";

export function getNextSetupOperation(domain: DomainRecord | null): SetupOperation {
  if (!domain) return "check_domain";
  const owned = domain.ownershipStatus === "purchased" || domain.ownershipStatus === "existing_owned_domain";
  if (!owned) return "ownership_required";
  if (!domain.cloudflareZoneId) return "create_zone";
  if (domain.nameserverStatus !== "configured") return "update_nameservers";
  if (domain.cloudflareZoneStatus !== "active") return "check_zone";
  if (domain.customDomainStatus !== "active") return "attach_worker";
  if (domain.sslStatus !== "ready") return "check_https";
  return "complete";
}