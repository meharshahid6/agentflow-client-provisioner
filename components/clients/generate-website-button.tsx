"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { WebsiteStatus } from "@/lib/clients/repository";

type GenerateWebsiteButtonProps = {
  clientId: string;
  websiteStatus: WebsiteStatus;
  className?: string;
};

type GenerateWebsiteResponse = {
  previewUrl?: string;
  error?: string;
};

async function readResponse(response: Response): Promise<GenerateWebsiteResponse> {
  const body = await response.text();

  if (!body) return {};

  try {
    return JSON.parse(body) as GenerateWebsiteResponse;
  } catch {
    return { error: `Website generator returned an invalid response (HTTP ${response.status}).` };
  }
}

export function GenerateWebsiteButton({ clientId, websiteStatus, className = "" }: GenerateWebsiteButtonProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  async function generateWebsite() {
    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}/website`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const result = await readResponse(response);

      if (!response.ok || !result.previewUrl) {
        setError(result.error ?? `Unable to generate the website preview (HTTP ${response.status}).`);
        return;
      }

      router.push(result.previewUrl);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown network error.";
      setError(`Unable to reach the website generator: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={generateWebsite}
        disabled={isGenerating}
        className={`inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 focus:outline-none disabled:cursor-wait disabled:opacity-60 ${className}`}
      >
        {isGenerating ? "Generating…" : websiteStatus === "not_generated" ? "Generate Website" : "Regenerate Website"}
      </button>
      {error ? <p className="mt-2 text-xs font-medium text-rose-600" role="alert">{error}</p> : null}
    </div>
  );
}
