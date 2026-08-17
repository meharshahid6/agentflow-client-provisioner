export type IntegrationProvider = "openai" | "agentrouter" | "hostinger" | "cloudflare" | "system";
export type IntegrationRunStatus = "pending" | "success" | "failed" | "skipped";

export async function recordIntegrationRun(
  db: D1Database,
  input: { clientId?: string; provider: IntegrationProvider; operation: string; status: IntegrationRunStatus; safeMessage: string },
) {
  await db.prepare(
    "INSERT INTO integration_runs (id, client_id, provider, operation, status, safe_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), input.clientId ?? null, input.provider, input.operation, input.status, input.safeMessage.slice(0, 500), new Date().toISOString()).run();
}