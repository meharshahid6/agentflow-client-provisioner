import "server-only";

import type { ClientRecord } from "@/lib/clients/repository";

import type { WebsiteContent } from "./configuration";

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 50_000;
const UNSUPPORTED_CLAIM_PATTERN = /\b(accredited|affordable|certified|certification|decades?|established|insured|licensed|licence[ds]?|award(?:-winning|ed|s)?|partner(?:ed|ship|s)?|guarantee(?:d|s)?|warrant(?:y|ies)|years? (?:of|in)|customers? served|clients? served|best price|lowest price|free estimate|pricing|rates?)\b/i;

export type AgentRouterEnvironment = {
  AI_PROVIDER?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
};

type GeneratedWebsiteContent = {
  heroHeadline: string;
  heroSubtitle: string;
  about: string;
  serviceDescriptions: string[];
  primaryCta: string;
  secondaryCta: string;
  seoTitle: string;
  seoDescription: string;
};

export type AgentRouterResult =
  | { status: "success"; content: WebsiteContent; seoTitle: string; safeMessage: string }
  | { status: "failed" | "skipped"; safeMessage: string };

function isBoundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function collectText(content: GeneratedWebsiteContent) {
  return [
    content.heroHeadline,
    content.heroSubtitle,
    content.about,
    ...content.serviceDescriptions,
    content.primaryCta,
    content.secondaryCta,
    content.seoTitle,
    content.seoDescription,
  ].join(" ");
}

function hasUnsupportedNumbers(text: string, client: ClientRecord) {
  const sourceNumbers = new Set(
    [client.businessName, client.legalBusinessName, client.category, client.description, client.address, client.city, client.country, ...client.services]
      .join(" ")
      .match(/\d+(?:[.,]\d+)*/g) ?? [],
  );
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).some((number) => !sourceNumbers.has(number));
}

export function validateAgentRouterContent(value: unknown, client: ClientRecord): GeneratedWebsiteContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const expectedKeys = ["about", "heroHeadline", "heroSubtitle", "primaryCta", "secondaryCta", "seoDescription", "seoTitle", "serviceDescriptions"];
  if (Object.keys(candidate).sort().join("|") !== expectedKeys.join("|")) return null;
  const serviceDescriptions = candidate.serviceDescriptions;
  if (
    !isBoundedString(candidate.heroHeadline, 8, 100) ||
    !isBoundedString(candidate.heroSubtitle, 20, 260) ||
    !isBoundedString(candidate.about, 40, 800) ||
    !Array.isArray(serviceDescriptions) ||
    serviceDescriptions.length !== client.services.length ||
    !serviceDescriptions.every((description) => isBoundedString(description, 15, 350)) ||
    !isBoundedString(candidate.primaryCta, 2, 40) ||
    !isBoundedString(candidate.secondaryCta, 2, 40) ||
    !isBoundedString(candidate.seoTitle, 8, 70) ||
    !isBoundedString(candidate.seoDescription, 40, 160)
  ) return null;

  const content = {
    heroHeadline: candidate.heroHeadline.trim(),
    heroSubtitle: candidate.heroSubtitle.trim(),
    about: candidate.about.trim(),
    serviceDescriptions: serviceDescriptions.map((description) => description.trim()),
    primaryCta: candidate.primaryCta.trim(),
    secondaryCta: candidate.secondaryCta.trim(),
    seoTitle: candidate.seoTitle.trim(),
    seoDescription: candidate.seoDescription.trim(),
  };
  const text = collectText(content);
  if (UNSUPPORTED_CLAIM_PATTERN.test(text) || hasUnsupportedNumbers(text, client)) return null;
  return content;
}

function parseResponseContent(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string") return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function buildPrompt(client: ClientRecord) {
  const businessData = {
    businessName: client.businessName,
    legalBusinessName: client.legalBusinessName || null,
    category: client.category,
    description: client.description || null,
    address: client.address || null,
    city: client.city || null,
    country: client.country,
    services: client.services,
  };
  return [
    "Create factual website copy using only the supplied business data.",
    "Do not infer or invent certifications, licenses, years in business, awards, customer counts, partnerships, guarantees, pricing, service areas, or locations.",
    "Do not add facts from outside knowledge. Do not include phone numbers, email addresses, URLs, FAQs, markdown, or HTML.",
    "Return only a JSON object with exactly these keys: heroHeadline, heroSubtitle, about, serviceDescriptions, primaryCta, secondaryCta, seoTitle, seoDescription.",
    "serviceDescriptions must contain exactly one description for each service, in the same order.",
    `Business data: ${JSON.stringify(businessData)}`,
  ].join("\n");
}

export async function generateAgentRouterContent(
  client: ClientRecord,
  env: AgentRouterEnvironment,
): Promise<AgentRouterResult> {
  const provider = env.AI_PROVIDER ?? process.env.AI_PROVIDER;
  const baseUrl = env.AI_BASE_URL ?? process.env.AI_BASE_URL;
  const apiKey = env.AI_API_KEY ?? process.env.AI_API_KEY;
  const model = env.AI_MODEL ?? process.env.AI_MODEL;
  if (provider !== "agentrouter" || !baseUrl || !apiKey || !model) {
    return { status: "skipped", safeMessage: "AgentRouter configuration is unavailable; deterministic content was used." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You write concise, factual business website content and return valid JSON only." },
          { role: "user", content: buildPrompt(client) },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { status: "failed", safeMessage: `AgentRouter request failed with HTTP ${response.status}; deterministic content was used.` };
    }
    const responseText = await response.text();
    if (responseText.length > MAX_RESPONSE_BYTES) {
      return { status: "failed", safeMessage: "AgentRouter returned an oversized response; deterministic content was used." };
    }
    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return { status: "failed", safeMessage: "AgentRouter returned an invalid response; deterministic content was used." };
    }
    const generated = validateAgentRouterContent(parseResponseContent(payload), client);
    if (!generated) {
      return { status: "failed", safeMessage: "AgentRouter content did not pass factual validation; deterministic content was used." };
    }
    return {
      status: "success",
      safeMessage: "AgentRouter content generated and validated successfully.",
      seoTitle: generated.seoTitle,
      content: {
        heroHeadline: generated.heroHeadline,
        heroSubheadline: generated.heroSubtitle,
        about: generated.about,
        serviceDescriptions: generated.serviceDescriptions,
        primaryCta: generated.primaryCta,
        secondaryCta: generated.secondaryCta,
        seoDescription: generated.seoDescription,
        faqs: [],
      },
    };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return {
      status: "failed",
      safeMessage: timedOut
        ? "AgentRouter request timed out; deterministic content was used."
        : "AgentRouter request could not be completed; deterministic content was used.",
    };
  } finally {
    clearTimeout(timeout);
  }
}