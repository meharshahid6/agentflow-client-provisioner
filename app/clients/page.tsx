import Link from "next/link";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { GenerateWebsiteButton } from "@/components/clients/generate-website-button";
import { listClients, type ClientRecord } from "@/lib/clients/repository";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

const statusStyles = {
  not_generated: "bg-slate-100 text-slate-600",
  draft: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
};

export default async function ClientsPage() {
  let clients: ClientRecord[] = [];
  let loadError = false;

  try {
    const { env } = getCloudflareContext();
    clients = await listClients(env.DB);
  } catch (error) {
    console.error("Failed to load clients page", error);
    loadError = true;
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-5 py-8 text-slate-900 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-indigo-600 uppercase">Agentflow · Client Provisioner</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Saved clients</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Persistent client records stored in your local or Cloudflare D1 database.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Link href="/dashboard" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700">Dashboard</Link><Link href="/" className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700">Add new client</Link></div>
        </div>

        {loadError ? (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Unable to load clients. Make sure the local D1 migration has been applied.</div>
        ) : clients.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-base font-bold text-slate-800">No clients saved yet</p>
            <p className="mt-2 text-sm text-slate-500">Create your first client profile to see it here.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {clients.map((client) => {
              const websiteStatus = client.websiteStatus ?? "not_generated";

              return (
              <article key={client.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">{client.businessName}</h2>
                    <p className="mt-1 text-xs font-medium text-indigo-600">{client.category}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${statusStyles[websiteStatus]}`}>{websiteStatus.replaceAll("_", " ")}</span>
                </div>
                <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div><p className="text-xs text-slate-400">Email</p><p className="mt-1 truncate font-medium text-slate-700">{client.email}</p></div>
                  <div><p className="text-xs text-slate-400">Location</p><p className="mt-1 font-medium text-slate-700">{[client.city, client.country].filter(Boolean).join(", ") || "—"}</p></div>
                </div>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-400">Services</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {client.services.map((service) => <span key={service} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">{service}</span>)}
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-1 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <span>Created {formatDate(client.createdAt)}</span>
                  <span className="truncate" title={client.id}>ID: {client.id}</span>
                </div>
                <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
                  <Link href={`/clients/${client.id}`} className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700">View Client</Link>
                  <GenerateWebsiteButton clientId={client.id} websiteStatus={websiteStatus} />
                </div>
              </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
