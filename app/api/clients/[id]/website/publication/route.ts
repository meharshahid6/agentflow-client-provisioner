import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getClientById } from "@/lib/clients/repository";
import { getWebsiteByClientId, setWebsitePublished, setWebsiteReview } from "@/lib/websites/repository";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { published?: boolean; reviewed?: boolean } | null;
  if (typeof body?.published !== "boolean" && typeof body?.reviewed !== "boolean") return Response.json({ error: "A publication action is required." }, { status: 422 });
  const { env } = getCloudflareContext();
  if (!await getClientById(env.DB, id)) return Response.json({ error: "Client not found." }, { status: 404 });
  const website = await getWebsiteByClientId(env.DB, id);
  if (!website) return Response.json({ error: "Generate the website before publishing it." }, { status: 409 });
  if (typeof body.reviewed === "boolean") {
    const result = await setWebsiteReview(env.DB, id, body.reviewed);
    return Response.json({ status: result.status });
  }
  const result = await setWebsitePublished(env.DB, id, body.published!);
  if (!result.updated) return Response.json({ error: "Review the website before publishing it." }, { status: 409 });
  return Response.json({ status: result.status });
}