import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import "./globals.css";
import { ApplicationShell } from "@/components/application-shell";

export const metadata: Metadata = {
  title: "Agentflow Client Provisioner",
  description: "A foundation for provisioning client workspaces.",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const isPublicSite = (await headers()).get("x-agentflow-public-site") === "1";
  return (
    <html lang="en">
      <body><ApplicationShell isPublicSite={isPublicSite}>{children}</ApplicationShell></body>
    </html>
  );
}
