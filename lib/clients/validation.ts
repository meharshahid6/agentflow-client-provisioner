export type LogoMetadata = {
  name: string;
  type: string;
  size: number;
};

export type ClientInput = {
  businessName: string;
  legalBusinessName: string;
  category: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  domain: string;
  facebook: string;
  instagram: string;
  services: string[];
  logo: LogoMetadata | null;
};

export type ValidationErrors = Record<string, string>;

type ValidationResult =
  | { success: true; data: ClientInput }
  | { success: false; errors: ValidationErrors };

const MAX_LOGO_SIZE = 5 * 1024 * 1024;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalUrl(value: unknown, field: string, errors: ValidationErrors) {
  const candidate = readString(value);
  if (!candidate) return "";

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      errors[field] = "Use a valid HTTP or HTTPS URL.";
      return "";
    }
  } catch {
    errors[field] = "Use a valid HTTP or HTTPS URL.";
    return "";
  }

  return candidate;
}

export function validateClientInput(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { success: false, errors: { form: "A valid client object is required." } };
  }

  const input = payload as Record<string, unknown>;
  const errors: ValidationErrors = {};
  const businessName = readString(input.businessName);
  const category = readString(input.category);
  const email = readString(input.email);
  const phone = readString(input.phone);
  const country = readString(input.country);

  if (!businessName) errors.businessName = "Business name is required.";
  if (!category) errors.category = "Business category is required.";
  if (!email) {
    errors.email = "Business email is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = "Enter a valid business email.";
  }
  if (!phone) errors.phone = "Business phone is required.";
  if (!country) errors.country = "Country is required.";

  const services = Array.isArray(input.services)
    ? input.services.filter((service): service is string => typeof service === "string").map((service) => service.trim()).filter(Boolean)
    : [];
  if (services.length === 0) errors.services = "At least one service is required.";

  const facebook = readOptionalUrl(input.facebook, "facebook", errors);
  const instagram = readOptionalUrl(input.instagram, "instagram", errors);

  let logo: LogoMetadata | null = null;
  if (input.logo !== null && input.logo !== undefined) {
    if (typeof input.logo !== "object" || Array.isArray(input.logo)) {
      errors.logo = "Logo metadata is invalid.";
    } else {
      const rawLogo = input.logo as Record<string, unknown>;
      const name = readString(rawLogo.name);
      const type = readString(rawLogo.type);
      const size = typeof rawLogo.size === "number" ? rawLogo.size : 0;

      if (!name || !type || size < 0 || size > MAX_LOGO_SIZE) {
        errors.logo = "Logo metadata is invalid or exceeds the 5 MB limit.";
      } else {
        logo = { name, type, size };
      }
    }
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };

  return {
    success: true,
    data: {
      businessName,
      legalBusinessName: readString(input.legalBusinessName),
      category,
      description: readString(input.description),
      email,
      phone,
      address: readString(input.address),
      city: readString(input.city),
      country,
      domain: readString(input.domain),
      facebook,
      instagram,
      services,
      logo,
    },
  };
}
