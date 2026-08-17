import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getClientById, updateWebsiteStatus } from "@/lib/clients/repository";
import { recordIntegrationRun } from "@/lib/integrations/repository";
import { generateAgentRouterContent, type AgentRouterEnvironment } from "@/lib/websites/agentrouter";
import { createWebsiteConfiguration } from "@/lib/websites/configuration";
import { getWebsiteByClientId, saveWebsite } from "@/lib/websites/repository";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: RouteContext<"/api/clients/[id]/website">) {
  const { id } = await context.params;

  try {
    const { env } = getCloudflareContext();
    const client = await getClientById(env.DB, id);

    if (!client) {
      return Response.json({ error: "Client not found." }, { status: 404 });
    }

    const existing = await getWebsiteByClientId(env.DB, id);
    const aiResult = await generateAgentRouterContent(client, env as CloudflareEnv & AgentRouterEnvironment);
    const configuration = createWebsiteConfiguration(client, {
      template: existing?.selectedTemplate,
      content: aiResult.status === "success" ? aiResult.content : undefined,
      contentSource: aiResult.status === "success" ? "agentrouter" : "deterministic",
      seoTitle: aiResult.status === "success" ? aiResult.seoTitle : undefined,
    });
    const status = configuration.readiness.isReady ? "ready" : "draft";
    await saveWebsite(env.DB, id, configuration.selectedTemplate, configuration, configuration.contentSource);
    await recordIntegrationRun(env.DB, {
      clientId: id,
      provider: "agentrouter",
      operation: "generate_website_content",
      status: aiResult.status,
      safeMessage: aiResult.safeMessage,
    });
    const result = await updateWebsiteStatus(env.DB, id, status);

    if (!result.updated) {
      return Response.json({ error: "Unable to update website status." }, { status: 500 });
    }

    return Response.json({
      clientId: id,
      websiteStatus: status,
      previewUrl: `/clients/${encodeURIComponent(id)}/website`,
      readiness: configuration.readiness,
      aiStatus: aiResult.status,
    });
  } catch (error) {
    console.error("Failed to generate website", error);
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return Response.json({ error: `Unable to generate the website preview: ${message}` }, { status: 500 });
  }
}
