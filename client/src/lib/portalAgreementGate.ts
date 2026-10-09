import { useQuery } from "@tanstack/react-query";
import type { AgreementGateMode, AgreementGateStatus, WelcomeVideo } from "@shared/portalAgreements";
import { portalGet } from "@/lib/portalApi";

/** GET /api/portal/agreements (server/portalAgreementRoutes.ts). */
export interface AgreementGateResponse {
  success: boolean;
  mode: AgreementGateMode;
  /** DE staff: never asked to sign. */
  exempt: boolean;
  company: { id: string; name: string } | null;
  signer: { name: string; email: string };
  status: AgreementGateStatus;
  videos: { company: WelcomeVideo; user: WelcomeVideo };
}

export const AGREEMENT_GATE_KEY = ["/api/portal/agreements"] as const;
export const AGREEMENT_GATE_PATH = "/portal/agreement-gate";

export function useAgreementGate(enabled = true) {
  return useQuery<AgreementGateResponse>({
    queryKey: AGREEMENT_GATE_KEY,
    queryFn: () => portalGet<AgreementGateResponse>("/api/portal/agreements"),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** Send this person to the gate? Only when enforced, never for DE staff, and never on a failed check (fail open). */
export function mustVisitGate(data: AgreementGateResponse | undefined): boolean {
  return Boolean(data && data.mode === "enforce" && !data.exempt && !data.status.complete);
}
