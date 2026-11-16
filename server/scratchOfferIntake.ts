import { randomInt } from "node:crypto";
import {
  SCRATCH_OFFER_TAG,
  SCRATCH_OFFER_TERMS,
  isExcludedState,
  normalizeState,
  buildClaimCode,
  validateClaimFields,
  type ClaimFieldErrors,
} from "@shared/scratchOffer";

/** Off in production unless SCRATCH_OFFER_ENABLED=1; always on in development. */
export function scratchOfferServerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SCRATCH_OFFER_ENABLED === "1" || env.SCRATCH_OFFER_ENABLED === "true") return true;
  return env.NODE_ENV !== "production";
}

export function isScratchOfferClaim(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as { offer?: unknown }).offer === SCRATCH_OFFER_TAG;
}

export type ScratchClaim = {
  email: string;
  company: string;
  state: string;
  marketingOptIn: boolean;
  claimCode: string;
};

export type ScratchClaimResult =
  | { ok: true; claim: ScratchClaim }
  | { ok: false; status: number; error: string; code?: "state_excluded"; fields?: ClaimFieldErrors };

export function parseScratchClaim(
  body: Record<string, unknown>,
  options: { enabled: boolean; randomIndex?: (max: number) => number },
): ScratchClaimResult {
  if (!options.enabled) return { ok: false, status: 404, error: "This offer isn't available." };

  const state = normalizeState(body.state);
  if (isExcludedState(state)) {
    return {
      ok: false,
      status: 403,
      code: "state_excluded",
      error: SCRATCH_OFFER_TERMS.excludedStateMessage,
      fields: { state: SCRATCH_OFFER_TERMS.excludedStateMessage },
    };
  }

  const fields = validateClaimFields({ email: body.email, company: body.company, state: body.state });
  if (Object.keys(fields).length > 0) {
    return { ok: false, status: 400, error: "Check the highlighted fields.", fields };
  }

  return {
    ok: true,
    claim: {
      email: String(body.email).trim(),
      company: String(body.company).trim(),
      state: state!,
      marketingOptIn: body.marketingOptIn === true,
      claimCode: buildClaimCode(options.randomIndex ?? ((max) => randomInt(max))),
    },
  };
}

/** Lines added to the lead note so the code lives on the CRM record. */
export function scratchClaimNote(claim: ScratchClaim): string {
  return [
    `Offer: ${SCRATCH_OFFER_TAG} (fee waiver pending DE review; confirm in writing)`,
    `Business state: ${claim.state}`,
    `Claim code: ${claim.claimCode} (single use; mark redeemed on this lead when booked)`,
    `Marketing email opt-in: ${claim.marketingOptIn ? "yes" : "no"}`,
  ].join("\n");
}
