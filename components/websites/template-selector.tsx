"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WebsiteTemplate } from "@/lib/websites/configuration";
const options: Array<[WebsiteTemplate, string]> = [["modern_business", "Modern Business"], ["professional_corporate", "Corporate Professional"], ["local_service", "Local Services"]];
export function TemplateSelector({ clientId, selected }: { clientId: string; selected: WebsiteTemplate }) {
  const router = useRouter(); const [saving, setSaving] = useState(false);
  async function update(template: WebsiteTemplate) { setSaving(true); const response = await fetch(`/api/clients/${clientId}/template`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template }) }); setSaving(false); if (response.ok) router.refresh(); }
  return <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">Template<select disabled={saving} value={selected} onChange={(event) => update(event.target.value as WebsiteTemplate)} className="border border-slate-300 bg-white px-3 py-2">{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>;
}