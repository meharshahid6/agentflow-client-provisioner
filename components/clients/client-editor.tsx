"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientRecord } from "@/lib/clients/repository";

export function ClientEditor({ client }: { client: ClientRecord }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const fields = [
    ["businessName", "Business name"], ["legalBusinessName", "Legal name"], ["category", "Category"],
    ["email", "Email"], ["phone", "Phone"], ["address", "Address"], ["city", "City"], ["country", "Country"],
    ["domain", "Preferred domain"], ["facebook", "Facebook URL"], ["instagram", "Instagram URL"],
  ] as const;
  async function submit(formData: FormData) {
    setSaving(true); setMessage("");
    const payload = Object.fromEntries(fields.map(([name]) => [name, String(formData.get(name) ?? "").trim()]));
    const response = await fetch(`/api/clients/${client.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, description: String(formData.get("description") ?? "").trim(), services: String(formData.get("services") ?? "").split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean), logo: client.logo }) });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(result.error ?? "Update failed.");
    setMessage("Saved. Readiness has been recalculated."); setEditing(false); router.refresh();
  }
  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Edit details</button>;
  return <form action={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
    {fields.map(([name, label]) => <label key={name} className="text-sm font-semibold text-slate-700">{label}<input name={name} defaultValue={client[name]} required={["businessName", "category", "email", "phone", "country"].includes(name)} className="mt-1.5 w-full border border-slate-300 px-3 py-2 font-normal" /></label>)}
    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea name="description" defaultValue={client.description} rows={4} className="mt-1.5 w-full border border-slate-300 px-3 py-2 font-normal" /></label>
    <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Services, one per line<textarea name="services" defaultValue={client.services.join("\n")} rows={4} className="mt-1.5 w-full border border-slate-300 px-3 py-2 font-normal" /></label>
    <div className="flex items-center gap-3 sm:col-span-2"><button disabled={saving} className="bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Saving..." : "Save changes"}</button><button type="button" onClick={() => setEditing(false)} className="px-3 py-2 text-sm font-bold text-slate-600">Cancel</button><span className="text-sm text-slate-600">{message}</span></div>
  </form>;
}