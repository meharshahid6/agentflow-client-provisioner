import { getWebsiteByClientId } from "@/lib/websites/repository";
import { getDomainByExactDomain, listDomainsByClientId, type DomainRecord } from "./repository";
import { isValidHostname, normalizeHostname } from "./validation";

const validAvailabilityStatuses = new Set(["not_checked", "available", "unavailable", "unknown", "failed"]);

export class DomainAssignmentConflict extends Error {}

export function isSafeUnusedCandidate(domain: DomainRecord) {
  return ["not_started", "confirmation_required", "pending"].includes(domain.purchaseStatus)
    && domain.purchasedAt === null
    && domain.ownershipStatus !== "purchased"
    && domain.ownershipStatus !== "existing_owned_domain"
    && !domain.cloudflareZoneId
    && domain.cloudflareZoneStatus === "not_started"
    && domain.nameserverStatus === "not_started"
    && !domain.customDomainId
    && domain.customDomainStatus === "not_started"
    && !domain.wwwCustomDomainId
    && domain.wwwCustomDomainStatus === "not_started"
    && domain.sslStatus === "not_started"
    && !domain.metaDnsRecordId
    && domain.metaVerificationStatus === "not_configured";
}

export async function inspectExistingOwnedDomainAssignment(db: D1Database, clientId: string, inputDomain: string) {
  const domain = normalizeHostname(inputDomain);
  if (!isValidHostname(domain)) throw new DomainAssignmentConflict("A valid exact domain is required.");
  const claimed = await getDomainByExactDomain(db, domain);
  if (claimed && claimed.clientId !== clientId) throw new DomainAssignmentConflict("This domain is already assigned to another client.");
  const competing = (await listDomainsByClientId(db, clientId)).filter((item) => item.domain !== domain);
  const blocked = competing.find((item) => !isSafeUnusedCandidate(item));
  if (blocked) throw new DomainAssignmentConflict(`Client already has purchased or configured domain ${blocked.domain}. Disconnect or explicitly replace it before assigning ${domain}.`);
  return { domain, target: claimed, replaceableDomains: competing.map((item) => item.domain), replaceableRecords: competing };
}

export async function assignExistingOwnedDomain(
  db: D1Database,
  clientId: string,
  inputDomain: string,
  verifyOwnership: (domain: string) => Promise<boolean>,
) {
  const domain = normalizeHostname(inputDomain);
  if (!isValidHostname(domain)) throw new DomainAssignmentConflict("A valid exact domain is required.");
  if (!await verifyOwnership(domain)) throw new DomainAssignmentConflict("Hostinger did not confirm ownership of this domain.");
  const inspection = await inspectExistingOwnedDomainAssignment(db, clientId, domain);
  const ownershipChecks = await Promise.all(inspection.replaceableRecords.map(async (candidate) => ({
    candidate,
    owned: await verifyOwnership(candidate.domain),
  })));
  const ownedCandidate = ownershipChecks.find((result) => result.owned);
  if (ownedCandidate) {
    throw new DomainAssignmentConflict(`Hostinger already owns competing domain ${ownedCandidate.candidate.domain}. It cannot be retired automatically.`);
  }
  const website = await getWebsiteByClientId(db, clientId);
  const now = new Date().toISOString();
  const id = inspection.target?.id ?? crypto.randomUUID();
  const availabilityStatus = inspection.target && validAvailabilityStatuses.has(inspection.target.availabilityStatus)
    ? inspection.target.availabilityStatus
    : "not_checked";
  const statements = inspection.replaceableRecords.map((candidate) =>
    db.prepare("DELETE FROM domains WHERE id = ? AND client_id = ?").bind(candidate.id, clientId)
  );
  statements.push(
    db.prepare(
      `INSERT INTO domains (id, client_id, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(domain) DO UPDATE SET updated_at = excluded.updated_at WHERE client_id = excluded.client_id`
    ).bind(id, clientId, inspection.domain, now, now),
    db.prepare("UPDATE domains SET ownership_status = 'existing_owned_domain', availability_status = ?, updated_at = ? WHERE domain = ? AND client_id = ?")
      .bind(availabilityStatus, now, inspection.domain, clientId),
    db.prepare("UPDATE clients SET preferred_domain = ?, updated_at = ? WHERE id = ?").bind(inspection.domain, now, clientId),
  );
  if (website) {
    const configuration = { ...website.configuration, online: { ...website.configuration.online, preferredDomain: inspection.domain } };
    statements.push(db.prepare("UPDATE websites SET generated_configuration = ?, updated_at = ? WHERE client_id = ?")
      .bind(JSON.stringify(configuration), now, clientId));
  }
  await db.batch(statements);
  const saved = await getDomainByExactDomain(db, inspection.domain);
  if (!saved || saved.clientId !== clientId) throw new Error("Domain assignment did not persist.");
  return { domain: saved, replacedDomains: inspection.replaceableDomains };
}