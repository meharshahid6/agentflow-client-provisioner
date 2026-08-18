import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { ApplicationShell } from "@/components/application-shell";

export const metadata: Metadata = {
  title: "Agentflow Client Provisioner",
  description: "A foundation for provisioning client workspaces.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><ApplicationShell>{children}</ApplicationShell></body>
    </html>
  );
}
