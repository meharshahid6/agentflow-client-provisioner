import { getCloudflareContext } from "@opennextjs/cloudflare";

import { createClient, listClients } from "@/lib/clients/repository";
import { validateClientInput } from "@/lib/clients/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { env } = getCloudflareContext();
    const clients = await listClients(env.DB);
    return Response.json({ clients });
  } catch (error) {
    console.error("Failed to list clients", error);
    return Response.json({ error: "Unable to load clients." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validation = validateClientInput(payload);
  if (!validation.success) {
    return Response.json({ error: "Validation failed.", fields: validation.errors }, { status: 422 });
  }

  try {
    const { env } = getCloudflareContext();
    const client = await createClient(env.DB, validation.data);
    return Response.json({ client }, { status: 201 });
  } catch (error) {
    console.error("Failed to create client", error);
    return Response.json({ error: "Unable to save client." }, { status: 500 });
  }
}
