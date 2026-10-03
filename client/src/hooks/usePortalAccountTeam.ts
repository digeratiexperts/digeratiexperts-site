import { useQuery } from "@tanstack/react-query";
import type { AccountTeam } from "@shared/accountManagers";
import { portalGet } from "@/lib/portalApi";

/** Signed-in portal user's assigned account manager + sales department. */
export function usePortalAccountTeam(): AccountTeam | undefined {
  const { data } = useQuery<{ accountTeam?: AccountTeam }>({
    queryKey: ["/api/portal/me", "accountTeam"],
    queryFn: () => portalGet<{ accountTeam?: AccountTeam }>("/api/portal/me"),
    staleTime: 5 * 60_000,
  });
  return data?.accountTeam;
}
