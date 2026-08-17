export type ProviderStatus = "Configured" | "Not configured" | "External auth required" | "Unavailable" | "Error";

export type ProviderStatuses = {
  d1: ProviderStatus;
  agentrouter: ProviderStatus;
  r2: ProviderStatus;
  hostinger: ProviderStatus;
  cloudflare: ProviderStatus;
};

type StatusEnv = Record<string, unknown>;

function hasStrings(env: StatusEnv, names: string[]) {
  return names.every((name) => typeof env[name] === "string" && Boolean((env[name] as string).trim()));
}

export function getProviderStatuses(env: StatusEnv): ProviderStatuses {
  const aiFields = ["AI_PROVIDER", "AI_BASE_URL", "AI_API_KEY", "AI_MODEL"];
  const aiConfigured = hasStrings(env, aiFields);
  const aiValid = env.AI_PROVIDER === "agentrouter" && typeof env.AI_BASE_URL === "string";
  return {
    d1: env.DB ? "Configured" : "Not configured",
    agentrouter: !aiConfigured ? "Not configured" : aiValid ? "Configured" : "Error",
    r2: env.LOGO_ASSETS ? "Configured" : "Not configured",
    hostinger: hasStrings(env, ["HOSTINGER_API_TOKEN"]) ? "Configured" : "Not configured",
    cloudflare: hasStrings(env, ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_WORKER_NAME"]) ? "Configured" : "Not configured",
  };
}

export async function getRuntimeProviderStatuses(env: StatusEnv & { DB?: D1Database }): Promise<ProviderStatuses> {
  const statuses = getProviderStatuses(env);
  if (!env.DB) return statuses;
  const latest = await env.DB.prepare(
    "SELECT provider, status FROM integration_runs WHERE provider IN ('agentrouter', 'hostinger', 'cloudflare') ORDER BY created_at DESC LIMIT 50",
  ).all<{ provider: string; status: string }>();
  const seen = new Set<string>();
  for (const row of latest.results ?? []) {
    if (seen.has(row.provider) || !(row.provider in statuses)) continue;
    seen.add(row.provider);
    const key = row.provider as keyof ProviderStatuses;
    if (statuses[key] === "Not configured") continue;
    if (row.status === "failed") statuses[key] = row.provider === "agentrouter" ? "External auth required" : "Unavailable";
  }
  return statuses;
}