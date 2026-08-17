import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { getRuntimeProviderStatuses } from "@/lib/integrations/provider-status";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const { env } = getCloudflareContext();
  const statuses = await getRuntimeProviderStatuses(env as unknown as Record<string, unknown> & { DB?: D1Database });
  const providers = [["D1", statuses.d1], ["AI AgentRouter", statuses.agentrouter], ["R2", statuses.r2], ["Hostinger", statuses.hostinger], ["Cloudflare", statuses.cloudflare]] as const;
  return <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900"><div className="mx-auto max-w-4xl"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-emerald-700">System</p><h1 className="mt-2 text-3xl font-bold">Provider settings</h1></div><Link href="/clients" className="text-sm font-semibold text-slate-600">Clients</Link></div><div className="mt-8 divide-y divide-slate-200 border border-slate-200 bg-white">{providers.map(([name, status]) => <div key={name} className="flex items-center justify-between gap-4 px-5 py-5"><strong>{name}</strong><span className={`text-right text-sm font-semibold ${status === "Configured" ? "text-emerald-700" : status === "Error" || status === "Unavailable" || status === "External auth required" ? "text-red-700" : "text-slate-500"}`}>{status}</span></div>)}</div><p className="mt-5 text-sm text-slate-500">This page reports configuration and latest runtime state only. Secret values are never displayed.</p></div></main>;
}