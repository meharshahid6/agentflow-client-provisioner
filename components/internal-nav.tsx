import Link from "next/link";

const links = [["Dashboard", "/dashboard"], ["New Client", "/"], ["Clients", "/clients"], ["Domains", "/domains"], ["Settings", "/settings"]] as const;

export function InternalNav() {
  return <nav className="flex flex-wrap gap-2">{links.map(([label, href]) => <Link key={href} href={href} className="border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500">{label}</Link>)}</nav>;
}