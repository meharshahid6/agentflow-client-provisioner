import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { listClients } from "@/lib/clients/repository";
import { listDomains } from "@/lib/domains/repository";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  const { env } = getCloudflareContext();
  const [domains, clients] = await Promise.all([listDomains(env.DB), listClients(env.DB)]);
  const names = new Map(clients.map((client) => [client.id, client.businessName]));
  const columns = ["Availability", "Purchase", "Zone", "Nameservers", "Worker", "HTTPS", "Meta TXT"];
  return <main className="px-5 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-semibold text-indigo-700">Advanced workspace</p><h1 className="mt-2 text-3xl font-bold">Domains</h1></div><Link href="/dashboard#domain-center" className="text-sm font-bold text-indigo-700">Open Dashboard Domain Center</Link></div><div className="mt-8 overflow-x-auto border border-slate-200 bg-white"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Client</th><th className="px-4 py-3">Domain</th>{columns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}<th className="px-4 py-3">Setup</th></tr></thead><tbody className="divide-y divide-slate-200">{domains.map((domain) => <tr key={domain.id}><td className="px-4 py-4 font-semibold">{names.get(domain.clientId) ?? "Unknown client"}</td><td className="px-4 py-4">{domain.domain}</td>{[domain.availabilityStatus, domain.ownershipStatus, domain.cloudflareZoneStatus, domain.nameserverStatus, domain.customDomainStatus, domain.sslStatus, domain.metaPublicDnsStatus === "dns_detected" ? "dns_detected" : domain.metaVerificationStatus].map((status, index) => <td key={`${domain.id}-${index}`} className="px-4 py-4 text-slate-600">{status.replaceAll("_", " ")}</td>)}<td className="px-4 py-4"><Link href={`/clients/${domain.clientId}`} className="font-semibold text-emerald-700">Open</Link></td></tr>)}{domains.length === 0 ? <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500">No domain records configured.</td></tr> : null}</tbody></table></div></div></main>;
}
