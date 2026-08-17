import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getClientById, setClientLogoStorage, setClientLogoUnavailable } from "@/lib/clients/repository";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const maxSize = 5 * 1024 * 1024;
function safeFilename(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 120) || "logo"; }

export async function POST(request: Request, context: RouteContext<"/api/clients/[id]/logo">) {
  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("logo");
  if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size <= 0 || file.size > maxSize) return Response.json({ error: "Use a PNG, JPEG, WebP, or GIF logo up to 5 MB." }, { status: 422 });
  const { env } = getCloudflareContext();
  if (!await getClientById(env.DB, id)) return Response.json({ error: "Client not found." }, { status: 404 });
  const bucket = (env as unknown as { LOGO_ASSETS?: { put?: (key: string, value: ArrayBuffer, options?: unknown) => Promise<unknown> } }).LOGO_ASSETS;
  if (!bucket || typeof bucket.put !== "function") {
    await setClientLogoUnavailable(env.DB, id, { name: file.name, type: file.type, size: file.size });
    return Response.json({ storage: "metadata_fallback", message: "R2 is unavailable; logo metadata was retained and the application remains usable." }, { status: 202 });
  }
  const key = `clients/${id}/logo/${safeFilename(file.name)}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  await setClientLogoStorage(env.DB, id, { name: file.name, type: file.type, size: file.size }, key);
  return Response.json({ storage: "r2", objectKey: key });
}

export async function GET(_request: Request, context: RouteContext<"/api/clients/[id]/logo">) {
  const { id } = await context.params;
  const { env } = getCloudflareContext();
  const client = await getClientById(env.DB, id);
  const bucket = (env as unknown as { LOGO_ASSETS?: { get?: (key: string) => Promise<{ body: BodyInit; httpMetadata?: { contentType?: string } } | null> } }).LOGO_ASSETS;
  if (!client?.logoObjectKey || !bucket || typeof bucket.get !== "function") return new Response("Logo not found", { status: 404 });
  const object = await bucket.get(client.logoObjectKey);
  return object ? new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? client.logo?.type ?? "application/octet-stream", "Cache-Control": "public, max-age=3600" } }) : new Response("Logo not found", { status: 404 });
}