export type ProviderError = { status: number; code: string | null; message: string };

export class ProviderRequestError extends Error {
  constructor(public readonly details: ProviderError) {
    super(details.message);
    this.name = "ProviderRequestError";
  }
}

export async function parseProviderResponse(response: Response) {
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (response.ok) return body;
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const nested = record.errors instanceof Array && record.errors[0] && typeof record.errors[0] === "object" ? record.errors[0] as Record<string, unknown> : {};
  const message = [record.message, record.error, nested.message].find((value): value is string => typeof value === "string") ?? `Provider request failed with HTTP ${response.status}.`;
  const codeValue = record.code ?? nested.code;
  throw new ProviderRequestError({ status: response.status, code: typeof codeValue === "string" || typeof codeValue === "number" ? String(codeValue) : null, message: message.slice(0, 300) });
}