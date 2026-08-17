type DnsAnswer = { type?: number; data?: string };

export function normalizeTxtAnswer(value: string) {
  return value.replace(/^"|"$/g, "").replace(/"\s+"/g, "");
}

export function hasExpectedTxtAnswer(payload: unknown, expected: string) {
  if (!payload || typeof payload !== "object") return false;
  const answers = (payload as { Answer?: unknown }).Answer;
  return Array.isArray(answers) && answers.some((answer) => {
    const row = answer as DnsAnswer;
    return row.type === 16 && typeof row.data === "string" && normalizeTxtAnswer(row.data) === expected;
  });
}

export async function checkPublicTxt(hostname: string, expected: string, requestFetch: typeof fetch = fetch) {
  const url = new URL("https://cloudflare-dns.com/dns-query");
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", "TXT");
  const response = await requestFetch(url, { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Public DNS lookup failed with HTTP ${response.status}.`);
  return hasExpectedTxtAnswer(await response.json(), expected);
}