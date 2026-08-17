import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getClientById, updateClient } from "@/lib/clients/repository";
import { validateClientInput } from "@/lib/clients/validation";
import { createWebsiteConfiguration } from "@/lib/websites/configuration";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/clients/[id]">) {
  const { id } = await context.params;
  const { env } = getCloudflareContext();
  const client = await getClientById(env.DB, id);
  return client ? Response.json({ client, readiness: createWebsiteConfiguration(client).readiness }) : Response.json({ error: "Client not found." }, { status: 404 });
}

export async function PUT(request: Request, context: RouteContext<"/api/clients/[id]">) {
  const validation = validateClientInput(await request.json().catch(() => null));
  if (!validation.success) return Response.json({ error: "Validation failed.", fields: validation.errors }, { status: 422 });
  const { id } = await context.params;
  const { env } = getCloudflareContext();
  if (!await getClientById(env.DB, id)) return Response.json({ error: "Client not found." }, { status: 404 });
  await updateClient(env.DB, id, validation.data);
  const client = await getClientById(env.DB, id);
  return Response.json({ client, readiness: createWebsiteConfiguration(client!).readiness });
}