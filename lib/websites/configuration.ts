import type { ClientRecord, WebsiteStatus } from "@/lib/clients/repository";

export type ReadinessKey =
  | "business_identity"
  | "description"
  | "contact_info"
  | "services"
  | "privacy_policy"
  | "terms"
  | "social_urls"
  | "placeholder_text"
  | "business_consistency";

export type WebsiteTemplate = "modern_business" | "professional_corporate" | "local_service";
export type WebsiteContentSource = "deterministic" | "openai" | "agentrouter";

export type WebsiteContent = {
  heroHeadline: string;
  heroSubheadline: string;
  about: string;
  serviceDescriptions: string[];
  primaryCta: string;
  secondaryCta: string;
  seoDescription: string;
  faqs: Array<{ question: string; answer: string }>;
};

export type ReadinessCheck = {
  key: ReadinessKey;
  label: string;
  ready: boolean;
  missing: string[];
};

export type WebsiteReadiness = {
  isReady: boolean;
  checks: ReadinessCheck[];
  missing: string[];
};

export type WebsiteConfiguration = {
  clientId: string;
  websiteStatus: WebsiteStatus;
  selectedTemplate: WebsiteTemplate;
  contentSource: WebsiteContentSource;
  content: WebsiteContent;
  seo: { title: string; description: string };
  identity: {
    businessName: string;
    legalBusinessName: string;
    category: string;
    description: string;
  };
  brand: {
    monogram: string;
    logoMetadata: ClientRecord["logo"];
    logoUrl: string;
  };
  services: string[];
  contact: {
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    formattedLocation: string;
  };
  online: {
    preferredDomain: string;
    facebook: string;
    instagram: string;
  };
  policies: {
    privacy: string[];
    terms: string[];
  };
  readiness: WebsiteReadiness;
};

function missingFields(fields: Array<[label: string, value: string]>) {
  return fields.filter(([, value]) => !value.trim()).map(([label]) => label);
}

function createReadiness(client: ClientRecord, policies: WebsiteConfiguration["policies"]): WebsiteReadiness {
  const identityMissing = missingFields([
    ["Business name", client.businessName],
    ["Business category", client.category],
  ]);
  const contactMissing = missingFields([
    ["Business email", client.email],
    ["Business phone", client.phone],
    ["Business address", client.address],
    ["City", client.city],
    ["Country", client.country],
  ]);
  const checks: ReadinessCheck[] = [
    {
      key: "business_identity",
      label: "Business identity",
      ready: identityMissing.length === 0,
      missing: identityMissing,
    },
    {
      key: "description",
      label: "Business description",
      ready: Boolean(client.description.trim()),
      missing: client.description.trim() ? [] : ["Business description"],
    },
    {
      key: "contact_info",
      label: "Contact information",
      ready: contactMissing.length === 0,
      missing: contactMissing,
    },
    {
      key: "services",
      label: "Services",
      ready: client.services.length > 0,
      missing: client.services.length > 0 ? [] : ["At least one service"],
    },
    {
      key: "privacy_policy",
      label: "Privacy policy",
      ready: policies.privacy.length > 0,
      missing: policies.privacy.length > 0 ? [] : ["Privacy policy"],
    },
    {
      key: "terms",
      label: "Terms of service",
      ready: policies.terms.length > 0,
      missing: policies.terms.length > 0 ? [] : ["Terms of service"],
    },
    {
      key: "social_urls",
      label: "Social URLs",
      ready: [client.facebook, client.instagram].filter(Boolean).every((value) => /^https?:\/\//.test(value)),
      missing: [client.facebook, client.instagram].filter(Boolean).every((value) => /^https?:\/\//.test(value)) ? [] : ["Valid social URLs"],
    },
    {
      key: "placeholder_text",
      label: "No placeholder text",
      ready: !/\b(lorem ipsum|business name needed|description needed|todo)\b/i.test([client.businessName, client.description, ...client.services].join(" ")),
      missing: /\b(lorem ipsum|business name needed|description needed|todo)\b/i.test([client.businessName, client.description, ...client.services].join(" ")) ? ["Remove placeholder text"] : [],
    },
    {
      key: "business_consistency",
      label: "Business information consistency",
      ready: Boolean(client.businessName && client.email && client.phone),
      missing: client.businessName && client.email && client.phone ? [] : ["Consistent business name and contact details"],
    },
  ];

  return {
    isReady: checks.every((check) => check.ready),
    checks,
    missing: checks.flatMap((check) => check.missing),
  };
}

export function selectTemplateForCategory(category: string): WebsiteTemplate {
  if (/health|financial|consult|professional|technology|agency/i.test(category)) return "professional_corporate";
  if (/retail|hospitality|service|education|other/i.test(category)) return "local_service";
  return "modern_business";
}

export function createDeterministicContent(client: ClientRecord): WebsiteContent {
  const businessName = client.businessName || "Business";
  const category = (client.category || "business").trim();
  const categoryLabel = /services?$/i.test(category) ? category : `${category} services`;
  const location = [client.city, client.country].filter(Boolean).join(", ");
  const serviceSummary = client.services.length ? client.services.slice(0, 3).join(", ") : categoryLabel.toLowerCase();
  return {
    heroHeadline: `${categoryLabel.charAt(0).toUpperCase()}${categoryLabel.slice(1).toLowerCase()} from ${businessName}`,
    heroSubheadline: client.description || `Explore the services offered by ${businessName}${location ? ` in ${location}` : ""}, then contact the team to discuss your needs.`,
    about: client.description || `${businessName} offers ${categoryLabel.toLowerCase()}${location ? ` in ${location}` : ""}. Contact the business directly for current service details and availability.`,
    serviceDescriptions: client.services.map((service) => `${businessName} offers ${service.toLowerCase()}. Contact the business to discuss scope and availability.`),
    primaryCta: "Call now",
    secondaryCta: "Email us",
    seoDescription: (client.description || `${businessName} offers ${serviceSummary}${location ? ` in ${location}` : ""}. Contact the business for service details and availability.`).slice(0, 160),
    faqs: [],
  };
}

function createMonogram(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
  return letters || "B";
}

export function createWebsiteConfiguration(
  client: ClientRecord,
  options: { template?: WebsiteTemplate; content?: WebsiteContent; contentSource?: WebsiteContentSource; seoTitle?: string } = {},
): WebsiteConfiguration {
  const businessName = client.businessName || "Business name needed";
  const content = options.content ?? createDeterministicContent(client);
  const policies = {
    privacy: [
      `For questions about information you choose to provide to ${businessName}, contact ${client.email || "the business directly"}.`,
      "This preview does not define additional data-collection or sharing practices. The final policy should be reviewed before publication.",
    ],
    terms: [
      `Contact ${businessName} directly to confirm service scope, pricing, availability, and engagement terms.`,
      "This preview does not add warranties, guarantees, licenses, certifications, or other business claims.",
    ],
  };

  const configuration: WebsiteConfiguration = {
    clientId: client.id,
    websiteStatus: client.websiteStatus,
    selectedTemplate: options.template ?? selectTemplateForCategory(client.category),
    contentSource: options.contentSource ?? "deterministic",
    content,
    seo: {
      title: options.seoTitle ?? `${businessName} | ${client.category || "Business Services"}`,
      description: content.seoDescription,
    },
    identity: {
      businessName,
      legalBusinessName: client.legalBusinessName,
      category: client.category,
      description: client.description,
    },
    brand: {
      monogram: createMonogram(client.businessName),
      logoMetadata: client.logo,
      logoUrl: client.logoObjectKey ? `/api/clients/${encodeURIComponent(client.id)}/logo` : "",
    },
    services: client.services,
    contact: {
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      country: client.country,
      formattedLocation: [client.address, client.city, client.country].filter(Boolean).join(", "),
    },
    online: {
      preferredDomain: client.domain,
      facebook: client.facebook,
      instagram: client.instagram,
    },
    policies,
    readiness: { isReady: false, checks: [], missing: [] },
  };

  configuration.readiness = createReadiness(client, policies);
  return configuration;
}
