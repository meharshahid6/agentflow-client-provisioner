"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [["Dashboard", "/dashboard"], ["New Client", "/"], ["Clients", "/clients"], ["Domains", "/domains"], ["Settings", "/settings"]] as const;

export function InternalNav() {
  const pathname = usePathname();
  return <nav className="flex flex-wrap gap-1" aria-label="Internal application navigation">{links.map(([label, href]) => {
    const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>{label}</Link>;
  })}</nav>;
}

export function InternalShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#f6f8fc] text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12"><Link href="/dashboard" className="shrink-0" aria-label="Agentflow Client Provisioner dashboard"><p className="text-sm font-bold tracking-tight text-slate-950">Agentflow</p><p className="text-[11px] font-medium text-slate-400">Client Provisioner</p></Link><div className="min-w-0 flex-1 lg:flex lg:justify-end"><InternalNav /></div></div></header>{children}</div>;
}