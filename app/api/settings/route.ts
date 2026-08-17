import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getRuntimeProviderStatuses } from "@/lib/integrations/provider-status";
export const dynamic = "force-dynamic";
export async function GET() { const { env } = getCloudflareContext(); return Response.json({ providers: await getRuntimeProviderStatuses(env as unknown as Record<string, unknown> & { DB?: D1Database }) }); }