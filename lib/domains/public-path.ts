export type PublicSitePath = "" | "privacy" | "terms";

export function resolvePublicPath(path?: string[]): PublicSitePath | null {
  const value = path?.join("/") ?? "";
  return value === "" || value === "privacy" || value === "terms" ? value : null;
}