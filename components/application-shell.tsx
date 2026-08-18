"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { InternalShell } from "@/components/internal-nav";

export function ApplicationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname.startsWith("/sites/") || pathname.startsWith("/api/");
  return isPublic ? children : <InternalShell>{children}</InternalShell>;
}