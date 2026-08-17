import type { HostingerClient } from "@/lib/integrations/hostinger";

export type DomainPurchaseInput = { domain: string; itemId: string; paymentMethodId: string; whoisId: number };

export async function registerDomainWithReconciliation(hostinger: HostingerClient, input: DomainPurchaseInput) {
  const portfolioDomain = await hostinger.findPortfolioDomain(input.domain);
  if (portfolioDomain) return { reconciled: true as const, portfolioDomain };
  const registration = await hostinger.registerDomain(input);
  return { reconciled: false as const, registration };
}