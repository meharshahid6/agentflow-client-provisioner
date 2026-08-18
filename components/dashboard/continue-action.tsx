"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SetupOperation } from "@/lib/domains/setup-sequence";

const labels: Record<SetupOperation, string> = { check_domain: "Check domain", ownership_required: "Review ownership", create_zone: "Create zone", update_nameservers: "Configure DNS", check_zone: "Check activation", attach_worker: "Connect website", check_worker: "Check connection", check_https: "Check HTTPS", complete: "View live site" };

export function ContinueAction({ clientId, operation, preferredDomain, hasWebsite, websiteStatus, liveHostname }: { clientId: string; operation: SetupOperation; preferredDomain: string; hasWebsite: boolean; websiteStatus: string; liveHostname?: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  if (operation === "complete" && liveHostname) return <Link href={`/sites/${liveHostname}`} className="inline-flex rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">View live</Link>;
  if (operation === "ownership_required") return <Link href={`/clients/${clientId}`} className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Review ownership</Link>;
  if (!hasWebsite) return <Link href={`/clients/${clientId}`} className="inline-flex rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">Generate website</Link>;
  if (websiteStatus === "draft") return <Link href={`/clients/${clientId}`} className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Review website</Link>;
  async function continueSetup() {
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/clients/${clientId}/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, ...(operation === "check_domain" ? { domain: preferredDomain } : {}) }) }); const result = await response.json() as { message?: string; error?: string }; if (!response.ok) throw new Error(result.error ?? "Setup operation failed."); setMessage(result.message ?? "Updated."); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Setup operation failed."); } finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col items-end gap-1"><button onClick={() => void continueSetup()} disabled={busy} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "Working..." : labels[operation]}</button>{message ? <small className="max-w-44 text-right text-[10px] text-slate-500">{message}</small> : null}</span>;
}