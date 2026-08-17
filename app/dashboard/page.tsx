import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { InternalNav } from "@/components/internal-nav";
import { listClients } from "@/lib/clients/repository";
import { listDomains } from "@/lib/domains/repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { env } = getCloudflareContext();
  const [clients, domains] = await Promise.all([listClients(env.DB), listDomains(env.DB)]);
  const metrics = [
    ["Total Clients", clients.length], ["Websites Generated", clients.filter((client) => client.websiteStatus !== "not_generated").length],
    ["Websites Ready", clients.filter((client) => client.websiteStatus === "ready").length], ["Domains Configured", domains.length],
    ["Domains Live", domains.filter((domain) => domain.customDomainStatus === "active" && domain.sslStatus === "ready").length],
    ["Setup Pending", clients.filter((client) => !domains.some((domain) => domain.clientId === client.id && domain.customDomainStatus === "active" && domain.sslStatus === "ready")).length],
  ] as const;
  return <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-semibold text-emerald-700">Agentflow Client Provisioner</p><h1 className="mt-2 text-3xl font-bold">Dashboard</h1></div><InternalNav /></div><section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([label, value]) => <article key={label} className="border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><strong className="mt-3 block text-3xl">{value}</strong></article>)}</section><section className="mt-8"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Recent clients</h2><Link href="/clients" className="text-sm font-semibold text-emerald-700">View all clients</Link></div><div className="mt-3 divide-y divide-slate-200 border border-slate-200 bg-white">{clients.slice(0, 6).map((client) => <Link key={client.id} href={`/clients/${client.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50"><span><strong className="block">{client.businessName}</strong><small className="text-slate-500">{client.category}</small></span><span className="text-sm font-semibold text-slate-600">{client.websiteStatus.replaceAll("_", " ")}</span></Link>)}{clients.length === 0 ? <p className="p-5 text-sm text-slate-500">No clients have been created.</p> : null}</div></section></div></main>;
}
