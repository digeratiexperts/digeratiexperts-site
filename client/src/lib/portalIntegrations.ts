import { useQuery } from "@tanstack/react-query";
import { portalGet } from "@/lib/portalApi";

/**
 * Mirrors server/portalIntegrations.ts: which data source backs the VPN,
 * phone and shipping pages. "sample" (the default) keeps today's sample
 * content and notice; "hidden" drops the page from the nav; "live" reads the
 * page's own endpoint (/api/portal/vpn, /phone, /shipping).
 */
export type IntegrationArea = "vpn" | "phone" | "shipping";
export type IntegrationMode = "sample" | "hidden" | "live";
export type IntegrationStatus = { mode: IntegrationMode; provider: string | null };
export type IntegrationMap = Record<IntegrationArea, IntegrationStatus>;

export const SAMPLE_STATUS: IntegrationStatus = { mode: "sample", provider: null };

export const DEFAULT_INTEGRATIONS: IntegrationMap = {
  vpn: SAMPLE_STATUS,
  phone: SAMPLE_STATUS,
  shipping: SAMPLE_STATUS,
};

export const INTEGRATIONS_QUERY_KEY = ["/api/portal/integrations"] as const;

/** Falls back to "sample" for every area while loading or on error. */
export function usePortalIntegrations(enabled = true): IntegrationMap {
  const { data } = useQuery<{ integrations: IntegrationMap }>({
    queryKey: INTEGRATIONS_QUERY_KEY,
    queryFn: () => portalGet<{ integrations: IntegrationMap }>("/api/portal/integrations"),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return { ...DEFAULT_INTEGRATIONS, ...(data?.integrations ?? {}) };
}
