import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GenerateWebsiteButton } from "@/components/clients/generate-website-button";
import { ClientEditor } from "@/components/clients/client-editor";
import { SetupPanel } from "@/components/clients/setup-panel";
import { getClientById } from "@/lib/clients/repository";
import { getDomainByClientId } from "@/lib/domains/repository";
import { getWebsiteByClientId } from "@/lib/websites/repository";
import { createWebsiteConfiguration } from "@/lib/websites/configuration";

export const dynamic = "force-dynamic";

const statusStyles = {
  not_generated: "bg-slate-100 text-slate-600",
  draft: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
};

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const client = await getClientById(env.DB, id);

  if (!client) notFound();

  const configuration = createWebsiteConfiguration(client);
  const [domain, website] = await Promise.all([getDomainByClientId(env.DB, id), getWebsiteByClientId(env.DB, id)]);

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-5 py-8 text-slate-900 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <Link href="/clients" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">← Back to clients</Link>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{client.businessName}</h1>
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase ${statusStyles[client.websiteStatus]}`}>{client.websiteStatus.replace("_", " ")}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-indigo-600">{client.category}</p>
          </div>
          <div className="w-full sm:w-auto sm:min-w-52">
            <GenerateWebsiteButton clientId={client.id} websiteStatus={client.websiteStatus} />
            {client.websiteStatus !== "not_generated" ? <Link href={`/clients/${client.id}/website`} className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700">View preview</Link> : null}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-950">Client details</h2><ClientEditor client={client} /></div>
            <dl className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2"><dt className="text-xs font-bold tracking-wide text-slate-400 uppercase">Description</dt><dd className="mt-2 leading-7 text-slate-700">{client.description || "Not provided"}</dd></div>
              <div><dt className="text-xs font-bold tracking-wide text-slate-400 uppercase">Email</dt><dd className="mt-2 break-all font-medium text-slate-700">{client.email}</dd></div>
              <div><dt className="text-xs font-bold tracking-wide text-slate-400 uppercase">Phone</dt><dd className="mt-2 font-medium text-slate-700">{client.phone}</dd></div>
              <div><dt className="text-xs font-bold tracking-wide text-slate-400 uppercase">Address</dt><dd className="mt-2 font-medium text-slate-700">{client.address || "Not provided"}</dd></div>
              <div><dt className="text-xs font-bold tracking-wide text-slate-400 uppercase">Location</dt><dd className="mt-2 font-medium text-slate-700">{[client.city, client.country].filter(Boolean).join(", ")}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-bold tracking-wide text-slate-400 uppercase">Services</dt><dd className="mt-3 flex flex-wrap gap-2">{client.services.map((service) => <span key={service} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">{service}</span>)}</dd></div>
            </dl>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold text-slate-950">Website readiness</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">The preview uses only saved client details and the shared policy copy.</p>
            <ul className="mt-6 space-y-3">
              {configuration.readiness.checks.map((check) => (
                <li key={check.key} className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${check.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{check.ready ? "✓" : "!"}</span>
                  <div><p className="text-sm font-semibold text-slate-700">{check.label}</p>{check.missing.length ? <p className="mt-1 text-xs leading-5 text-amber-700">Missing: {check.missing.join(", ")}</p> : null}</div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
        <SetupPanel clientId={client.id} preferredDomain={client.domain} domain={domain} hasWebsite={Boolean(website)} aiSuccess={website?.contentSource === "agentrouter"} />
      </div>
    </main>
  );
}
