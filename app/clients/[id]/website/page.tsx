import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BusinessWebsiteTemplate } from "@/components/websites/business-website-template";
import { TemplateSelector } from "@/components/websites/template-selector";
import { getClientById } from "@/lib/clients/repository";
import { createWebsiteConfiguration } from "@/lib/websites/configuration";
import { getWebsiteByClientId } from "@/lib/websites/repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const website = await getWebsiteByClientId(env.DB, id);
  if (!website) return {};
  return { title: website.configuration.seo.title, description: website.configuration.seo.description, openGraph: { title: website.configuration.seo.title, description: website.configuration.seo.description, type: "website" } };
}

export default async function WebsitePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const client = await getClientById(env.DB, id);

  if (!client) notFound();

  const website = await getWebsiteByClientId(env.DB, id);
  const configuration = website?.configuration ?? createWebsiteConfiguration(client);
  return <><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3"><div><p className="text-sm font-bold text-slate-900">Website preview</p><p className="text-xs text-slate-500">Content source: {configuration.contentSource}</p></div><TemplateSelector clientId={id} selected={configuration.selectedTemplate} /></div><BusinessWebsiteTemplate configuration={configuration} /></>;
}
