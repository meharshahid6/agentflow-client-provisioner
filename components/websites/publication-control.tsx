"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PublicationControl({ clientId, status }: { clientId: string; status: "draft" | "ready_for_publication" | "published" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canPublish = status === "ready_for_publication" || status === "published";
  const published = status === "published";

  async function updatePublication(payload: { published: boolean } | { reviewed: boolean }) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/clients/${clientId}/website/publication`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as { status?: string; error?: string };
    setBusy(false);
    setMessage(result.status ? `Website is ${result.status.replaceAll("_", " ")}.` : result.error ?? "Publication update failed.");
    router.refresh();
  }

  return <div className="flex flex-wrap items-center gap-3">
    {status === "draft" ? <button type="button" disabled={busy} onClick={() => updatePublication({ reviewed: true })} className="border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 disabled:opacity-50">Mark reviewed</button> : <button type="button" disabled={busy || !canPublish} onClick={() => updatePublication({ published: !published })} className="border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">{published ? "Unpublish website" : "Publish website"}</button>}
    {message ? <span className="text-xs text-slate-600" role="status">{message}</span> : null}
  </div>;
}