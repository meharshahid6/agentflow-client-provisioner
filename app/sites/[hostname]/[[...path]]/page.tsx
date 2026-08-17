import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BusinessWebsiteTemplate, PolicyPage } from "@/components/websites/business-website-template";
import { getDomainByHostname } from "@/lib/domains/repository";
import { resolvePublicPath } from "@/lib/domains/public-path";
import { getWebsiteByClientId } from "@/lib/websites/repository";

export const dynamic = "force-dynamic";

async function resolveSite(hostname: string) {
  const { env } = getCloudflareContext();
  const domain = await getDomainByHostname(env.DB, decodeURIComponent(hostname));
  if (!domain) return null;
  const website = await getWebsiteByClientId(env.DB, domain.clientId);
  return website ? { domain, website } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ hostname: string; path?: string[] }> }): Promise<Metadata> {
  const { hostname, path } = await params;
  const site = await resolveSite(hostname);
  if (!site) return { title: "Site Not Configured" };
  const publicPath = resolvePublicPath(path);
  if (publicPath === null) return { title: "Page Not Found" };
  const { seo } = site.website.configuration;
  const policyTitle = publicPath === "privacy" ? "Privacy Policy" : publicPath === "terms" ? "Terms of Service" : null;
  return {
    metadataBase: new URL(`https://${site.domain.domain}`),
    title: policyTitle ? `${policyTitle} | ${site.website.configuration.identity.businessName}` : seo.title,
    description: seo.description,
    alternates: { canonical: publicPath ? `/${publicPath}` : "/" },
    openGraph: { title: policyTitle ?? seo.title, description: seo.description, url: publicPath ? `/${publicPath}` : "/", type: "website" },
  };
}

export default async function PublicSite({ params }: { params: Promise<{ hostname: string; path?: string[] }> }) {
  const { hostname, path } = await params;
  const site = await resolveSite(hostname);
  const publicPath = resolvePublicPath(path);
  if (!site || publicPath === null) notFound();
  if (publicPath === "privacy" || publicPath === "terms") return <PolicyPage configuration={site.website.configuration} policy={publicPath} />;
  return <BusinessWebsiteTemplate configuration={site.website.configuration} isPreview={false} />;
}