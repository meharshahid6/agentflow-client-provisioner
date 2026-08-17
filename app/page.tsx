"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";

type ClientForm = {
  businessName: string;
  legalBusinessName: string;
  category: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  domain: string;
  facebook: string;
  instagram: string;
};

type ServiceItem = {
  id: number;
  value: string;
};

type ErrorKey = "businessName" | "category" | "email" | "phone" | "country" | "services" | "facebook" | "instagram" | "logo" | "form";
type FormErrors = Partial<Record<ErrorKey, string>>;
type SaveStatus = "idle" | "saving" | "saved" | "error";

const initialForm: ClientForm = {
  businessName: "",
  legalBusinessName: "",
  category: "",
  description: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  domain: "",
  facebook: "",
  instagram: "",
};

const categories = [
  "Agency",
  "Consulting",
  "E-commerce",
  "Education",
  "Financial Services",
  "Healthcare",
  "Hospitality",
  "Professional Services",
  "Retail",
  "Technology",
  "Other",
];

const steps = [
  { number: "01", label: "Business details", active: true },
  { number: "02", label: "Brand identity", active: false },
  { number: "03", label: "Service setup", active: false },
  { number: "04", label: "Review & launch", active: false },
];

const inputClass = (hasError = false) =>
  `mt-2 w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 ${
    hasError ? "border-rose-300 ring-4 ring-rose-500/5" : "border-slate-200"
  }`;

function BuildingIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M5.25 21V5.25L12 3l6.75 2.25V21M8.25 8.25h.008v.008H8.25V8.25Zm0 3.75h.008v.008H8.25V12Zm0 3.75h.008v.008H8.25V15.75Zm3.75-7.5h.008v.008H12V8.25Zm0 3.75h.008v.008H12V12Zm0 3.75h.008v.008H12V15.75Zm3.75-7.5h.008v.008H15.75V8.25Zm0 3.75h.008v.008H15.75V12Zm0 3.75h.008v.008H15.75V15.75Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15m-10.5 4.125v5.25m6-5.25v5.25M9 7.5V5.25h6V7.5m-8.25 0 .75 12h9l.75-12" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V4.5m0 0L7.875 8.625M12 4.5l4.125 4.125M5.25 15.75v1.5A2.25 2.25 0 0 0 7.5 19.5h9a2.25 2.25 0 0 0 2.25-2.25v-1.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-rose-600">{message}</p>;
}

export default function Home() {
  const [form, setForm] = useState<ClientForm>(initialForm);
  const [services, setServices] = useState<ServiceItem[]>([{ id: 1, value: "" }]);
  const [nextServiceId, setNextServiceId] = useState(2);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedClientId, setSavedClientId] = useState<string | null>(null);

  function clearError(field: ErrorKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: keyof ClientForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveStatus("idle");
    setSavedClientId(null);
    setSaveMessage("");
    if (field === "businessName" || field === "category" || field === "email" || field === "phone" || field === "country" || field === "facebook" || field === "instagram") {
      clearError(field);
    }
  }

  function updateService(id: number, value: string) {
    setServices((current) => current.map((service) => (service.id === id ? { ...service, value } : service)));
    setSaveStatus("idle");
    setSavedClientId(null);
    setSaveMessage("");
    clearError("services");
  }

  function addService() {
    setServices((current) => [...current, { id: nextServiceId, value: "" }]);
    setNextServiceId((current) => current + 1);
    setSaveStatus("idle");
    setSavedClientId(null);
    setSaveMessage("");
  }

  function removeService(id: number) {
    setServices((current) => {
      if (current.length === 1) return [{ ...current[0], value: "" }];
      return current.filter((service) => service.id !== id);
    });
    setSaveStatus("idle");
    setSavedClientId(null);
    setSaveMessage("");
  }

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!form.businessName.trim()) nextErrors.businessName = "Business name is required.";
    if (!form.category) nextErrors.category = "Choose a business category.";
    if (!form.email.trim()) {
      nextErrors.email = "Business email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      nextErrors.email = "Enter a valid business email.";
    }
    if (!form.phone.trim()) nextErrors.phone = "Business phone is required.";
    if (!form.country.trim()) nextErrors.country = "Country is required.";
    if (!services.some((service) => service.value.trim())) nextErrors.services = "Add at least one service.";

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSaveStatus("idle");
      setSavedClientId(null);
      return;
    }

    setErrors({});
    setSaveStatus("saving");
    setSaveMessage("");
    setSavedClientId(null);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          services: services.map((service) => service.value),
          logo: logoFile ? { name: logoFile.name, type: logoFile.type, size: logoFile.size } : null,
        }),
      });
      const result: { client?: { id: string }; error?: string; fields?: FormErrors } = await response.json();

      if (!response.ok) {
        setErrors(result.fields ?? { form: result.error ?? "Unable to save client." });
        setSaveStatus("error");
        setSaveMessage(result.error ?? "Unable to save client.");
        return;
      }

      setSaveStatus("saved");
      setSavedClientId(result.client?.id ?? null);
      if (logoFile && result.client?.id) {
        const logoForm = new FormData();
        logoForm.set("logo", logoFile);
        const logoResponse = await fetch(`/api/clients/${result.client.id}/logo`, { method: "POST", body: logoForm });
        const logoResult = await logoResponse.json().catch(() => ({})) as { storage?: string };
        setSaveMessage(logoResponse.ok && logoResult.storage === "r2" ? "Client and logo saved." : "Client saved; logo metadata retained because R2 is unavailable.");
      } else {
        setSaveMessage("Client saved to D1.");
      }
    } catch {
      setSaveStatus("error");
      setSaveMessage("Unable to reach the client storage service.");
    }
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    setLogoFile(event.target.files?.[0] ?? null);
    setSaveStatus("idle");
    setSavedClientId(null);
    setSaveMessage("");
    clearError("logo");
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-7">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <BuildingIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-950">Agentflow</p>
              <p className="text-[11px] font-medium text-slate-400">Client Provisioner</p>
            </div>
          </div>

          <div className="flex-1 px-5 py-8">
            <p className="px-3 text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">Onboarding flow</p>
            <nav className="mt-5 space-y-2" aria-label="Onboarding steps">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 ${step.active ? "bg-indigo-50 text-indigo-700" : "text-slate-400"}`}
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold ${step.active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                    {step.number}
                  </span>
                  <span className={`text-sm font-semibold ${step.active ? "text-indigo-900" : "text-slate-500"}`}>{step.label}</span>
                </div>
              ))}
            </nav>

            <div className="mt-12 rounded-2xl bg-slate-950 p-5 text-white">
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-cyan-300">
                <CheckIcon />
              </div>
              <p className="text-sm font-semibold">Simple, secure setup</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">Your details stay in this browser until integrations are added.</p>
            </div>
          </div>

          <div className="border-t border-slate-100 px-7 py-5">
            <p className="text-xs text-slate-400">Workspace</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">New client profile</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8 lg:px-12">
            <div>
              <p className="text-xs font-medium text-slate-400">Client Provisioner</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Create a new client</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/clients" className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 sm:inline-flex">View saved clients</Link>
              <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 md:inline-flex">D1 storage</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">AC</div>
            </div>
          </header>

          <div className="border-b border-slate-200 bg-white px-5 py-3 lg:hidden">
            <div className="flex gap-2 overflow-x-auto" aria-label="Onboarding steps">
              {steps.map((step) => (
                <div key={step.number} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${step.active ? "bg-indigo-50 text-indigo-700" : "text-slate-400"}`}>
                  <span className="font-bold">{step.number}</span>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
            <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-indigo-600 uppercase">Step 01 · Business details</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Tell us about your business</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Add the core details we&apos;ll use to prepare your client workspace. You can update these details later.</p>
              </div>
              <p className="text-xs font-medium text-slate-400"><span className="text-rose-500">*</span> Required fields</p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} noValidate>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-7" aria-labelledby="business-information-heading">
                <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><BuildingIcon /></div>
                  <div>
                    <h2 id="business-information-heading" className="text-base font-bold text-slate-950">Business information</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">The primary identity and description of the client business.</p>
                  </div>
                </div>
                <div className="grid gap-5 pt-6 md:grid-cols-2">
                  <div>
                    <label htmlFor="businessName" className="text-sm font-semibold text-slate-700">Business name <span className="text-rose-500">*</span></label>
                    <input id="businessName" name="businessName" value={form.businessName} onChange={(event) => updateField("businessName", event.target.value)} className={inputClass(Boolean(errors.businessName))} placeholder="e.g. Northstar Studio" aria-invalid={Boolean(errors.businessName)} />
                    <FieldError message={errors.businessName} />
                  </div>
                  <div>
                    <label htmlFor="legalBusinessName" className="text-sm font-semibold text-slate-700">Legal business name</label>
                    <input id="legalBusinessName" name="legalBusinessName" value={form.legalBusinessName} onChange={(event) => updateField("legalBusinessName", event.target.value)} className={inputClass()} placeholder="e.g. Northstar Studio LLC" />
                  </div>
                  <div>
                    <label htmlFor="category" className="text-sm font-semibold text-slate-700">Business category <span className="text-rose-500">*</span></label>
                    <select id="category" name="category" value={form.category} onChange={(event) => updateField("category", event.target.value)} className={inputClass(Boolean(errors.category))} aria-invalid={Boolean(errors.category)}>
                      <option value="">Select a category</option>
                      {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <FieldError message={errors.category} />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="description" className="text-sm font-semibold text-slate-700">Business description</label>
                    <textarea id="description" name="description" value={form.description} onChange={(event) => updateField("description", event.target.value)} className={`${inputClass()} min-h-28 resize-y`} placeholder="Briefly describe what the business does and who it serves." />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-7" aria-labelledby="contact-information-heading">
                <div className="border-b border-slate-100 pb-5">
                  <h2 id="contact-information-heading" className="text-base font-bold text-slate-950">Contact information</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Where the client team and business are located.</p>
                </div>
                <div className="grid gap-5 pt-6 md:grid-cols-2">
                  <div>
                    <label htmlFor="email" className="text-sm font-semibold text-slate-700">Business email <span className="text-rose-500">*</span></label>
                    <input id="email" name="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} className={inputClass(Boolean(errors.email))} placeholder="hello@business.com" aria-invalid={Boolean(errors.email)} />
                    <FieldError message={errors.email} />
                  </div>
                  <div>
                    <label htmlFor="phone" className="text-sm font-semibold text-slate-700">Business phone <span className="text-rose-500">*</span></label>
                    <input id="phone" name="phone" type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className={inputClass(Boolean(errors.phone))} placeholder="+1 (555) 000-0000" aria-invalid={Boolean(errors.phone)} />
                    <FieldError message={errors.phone} />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="address" className="text-sm font-semibold text-slate-700">Business address</label>
                    <input id="address" name="address" value={form.address} onChange={(event) => updateField("address", event.target.value)} className={inputClass()} placeholder="Street address, suite, or building" />
                  </div>
                  <div>
                    <label htmlFor="city" className="text-sm font-semibold text-slate-700">City</label>
                    <input id="city" name="city" value={form.city} onChange={(event) => updateField("city", event.target.value)} className={inputClass()} placeholder="e.g. Austin" />
                  </div>
                  <div>
                    <label htmlFor="country" className="text-sm font-semibold text-slate-700">Country <span className="text-rose-500">*</span></label>
                    <input id="country" name="country" value={form.country} onChange={(event) => updateField("country", event.target.value)} className={inputClass(Boolean(errors.country))} placeholder="e.g. United States" aria-invalid={Boolean(errors.country)} />
                    <FieldError message={errors.country} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-7" aria-labelledby="online-presence-heading">
                <div className="border-b border-slate-100 pb-5">
                  <h2 id="online-presence-heading" className="text-base font-bold text-slate-950">Online presence</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Share the channels your client uses to reach its audience.</p>
                </div>
                <div className="grid gap-5 pt-6 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label htmlFor="domain" className="text-sm font-semibold text-slate-700">Preferred domain name</label>
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">www.</span>
                      <input id="domain" name="domain" value={form.domain} onChange={(event) => updateField("domain", event.target.value)} className={`${inputClass()} pl-14`} placeholder="yourbusiness.com" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="facebook" className="text-sm font-semibold text-slate-700">Facebook Page URL</label>
                    <input id="facebook" name="facebook" type="url" value={form.facebook} onChange={(event) => updateField("facebook", event.target.value)} className={inputClass()} placeholder="https://facebook.com/..." />
                    <FieldError message={errors.facebook} />
                  </div>
                  <div>
                    <label htmlFor="instagram" className="text-sm font-semibold text-slate-700">Instagram URL</label>
                    <input id="instagram" name="instagram" type="url" value={form.instagram} onChange={(event) => updateField("instagram", event.target.value)} className={inputClass()} placeholder="https://instagram.com/..." />
                    <FieldError message={errors.instagram} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-7" aria-labelledby="services-heading">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
                  <div>
                    <h2 id="services-heading" className="text-base font-bold text-slate-950">Services</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">List the core services this client offers.</p>
                  </div>
                  <button type="button" onClick={addService} className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100">
                    <PlusIcon /> Add service
                  </button>
                </div>
                <div className="space-y-3 pt-6">
                  {services.map((service, index) => (
                    <div key={service.id} className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xs font-bold text-slate-400">{String(index + 1).padStart(2, "0")}</div>
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`service-${service.id}`} className="sr-only">Service {index + 1}</label>
                        <input id={`service-${service.id}`} value={service.value} onChange={(event) => updateService(service.id, event.target.value)} className={inputClass(Boolean(errors.services) && !service.value.trim())} placeholder="e.g. Brand strategy and design" aria-invalid={Boolean(errors.services) && !service.value.trim()} />
                      </div>
                      <button type="button" onClick={() => removeService(service.id)} className="mt-2 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove service ${index + 1}`}>
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                  <FieldError message={errors.services} />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:p-7" aria-labelledby="branding-heading">
                <div className="border-b border-slate-100 pb-5">
                  <h2 id="branding-heading" className="text-base font-bold text-slate-950">Branding</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Add a logo to help identify this client workspace.</p>
                </div>
                <div className="pt-6">
                  <label htmlFor="logo" className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-9 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm"><UploadIcon /></span>
                    <span className="mt-4 text-sm font-semibold text-slate-700">{logoFile ? logoFile.name : "Upload your logo"}</span>
                    <span className="mt-1.5 text-xs text-slate-400">PNG, JPG, WebP, or GIF · max 5 MB</span>
                    <span className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm">Choose file</span>
                  </label>
                  <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleLogoChange} className="sr-only" />
                  <FieldError message={errors.logo} />
                  <p className="mt-3 text-xs text-slate-400">Logo files use R2 when configured; metadata is retained when object storage is unavailable.</p>
                </div>
              </section>

              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div aria-live="polite">
                  {saveStatus === "saved" ? (
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100"><CheckIcon /></span>{saveMessage}</p>
                      {savedClientId ? <p className="mt-1 pl-8 text-xs text-slate-500">Client ID: <span className="font-mono text-slate-700">{savedClientId}</span></p> : null}
                    </div>
                  ) : saveStatus === "error" ? (
                    <p className="text-sm font-semibold text-rose-600">{saveMessage || errors.form || "Unable to save client."}</p>
                  ) : saveStatus === "saving" ? (
                    <p className="text-sm font-semibold text-indigo-600">Saving client to D1…</p>
                  ) : (
                    <p className="text-xs text-slate-400">All required fields must be completed before saving.</p>
                  )}
                </div>
                <button type="submit" disabled={saveStatus === "saving"} className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60">{saveStatus === "saving" ? "Saving…" : "Save Client"}</button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}
