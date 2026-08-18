"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { InternalShell } from "@/components/internal-nav";

export function ApplicationShell({ children, isPublicSite = false }: { children: ReactNode; isPublicSite?: boolean }) {
  const pathname = usePathname();
  const isPublic = isPublicSite || pathname.startsWith("/sites/") || pathname.startsWith("/api/");
  return isPublic ? children : <InternalShell>{children}</InternalShell>;
}