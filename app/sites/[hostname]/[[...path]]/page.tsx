import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BusinessWebsiteTemplate } from "@/components/websites/business-website-template";
import { getDomainByHostname } from "@/lib/domains/repository";
import { getWebsiteByClientId } from "@/lib/websites/repository";

export const dynamic = "force-dynamic";

async function resolveSite(hostname: string) {
  const { env } = getCloudflareContext();
  const domain = await getDomainByHostname(env.DB, decodeURIComponent(hostname));
  if (!domain) return null;
  const website = await getWebsiteByClientId(env.DB, domain.clientId);
  return website ? { domain, website } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ hostname: string }> }): Promise<Metadata> {
  const { hostname } = await params;
  const site = await resolveSite(hostname);
  if (!site) return { title: "Site Not Configured" };
  const { seo } = site.website.configuration;
  return {
    metadataBase: new URL(`https://${site.domain.domain}`),
    title: seo.title,
    description: seo.description,
    alternates: { canonical: "/" },
    openGraph: { title: seo.title, description: seo.description, url: "/", type: "website" },
  };
}

export default async function PublicSite({ params }: { params: Promise<{ hostname: string; path?: string[] }> }) {
  const { hostname, path } = await params;
  const site = await resolveSite(hostname);
  if (!site || (path?.length ?? 0) > 0) notFound();
  return <BusinessWebsiteTemplate configuration={site.website.configuration} isPreview={false} />;
}