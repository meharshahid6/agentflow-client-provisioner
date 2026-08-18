const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const META_PREFIX = "facebook-domain-verification=";

export function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].replace(/\.$/, "");
}

export function normalizeRegistrationDomain(value: string) {
  const hostname = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].replace(/\.$/, "");
  return hostname;
}

export function splitRegistrationDomain(value: string) {
  const domain = normalizeRegistrationDomain(value);
  const separator = domain.indexOf(".");
  if (separator <= 0 || separator === domain.length - 1) throw new Error("A registrable domain is required.");
  return { domain: domain.slice(0, separator), tld: domain.slice(separator + 1) };
}

export function isValidHostname(value: string) {
  return HOSTNAME_PATTERN.test(normalizeHostname(value));
}

export function validateMetaVerification(value: string) {
  const normalized = value.trim();
  if (!normalized.startsWith(META_PREFIX)) return { valid: false as const, error: `Value must start with ${META_PREFIX}` };
  const token = normalized.slice(META_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(token)) return { valid: false as const, error: "Verification token format is invalid." };
  return { valid: true as const, value: normalized, token };
}