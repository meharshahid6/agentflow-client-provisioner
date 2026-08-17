import { getCloudflareContext } from "@opennextjs/cloudflare";
import { updateWebsiteTemplate } from "@/lib/websites/repository";
import type { WebsiteTemplate } from "@/lib/websites/configuration";

const templates = new Set<WebsiteTemplate>(["modern_business", "professional_corporate", "local_service"]);
export async function PUT(request: Request, context: RouteContext<"/api/clients/[id]/template">) {
  const body = await request.json().catch(() => null) as { template?: WebsiteTemplate } | null;
  if (!body?.template || !templates.has(body.template)) return Response.json({ error: "Invalid template." }, { status: 422 });
  const { id } = await context.params;
  const { env } = getCloudflareContext();
  const website = await updateWebsiteTemplate(env.DB, id, body.template);
  return website ? Response.json({ website }) : Response.json({ error: "Generate the website before selecting a template." }, { status: 404 });
}