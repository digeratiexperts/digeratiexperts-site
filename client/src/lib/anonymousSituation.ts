import { useMemo } from "react";
import {
  parseAnonymousSituation,
  situationPublicLine,
  suggestedContactService,
  type AnonymousSituation,
  type SituationFamilyId,
} from "@shared/anonymousSituation";
import {
  SOLUTION_WORKSPACE_PATH,
  BUSINESS_NEEDS_INDEX_PATH,
} from "@/lib/businessNeeds";
import { useSolutionDraft } from "@/hooks/useSolutionDraft";
import {
  readSolutionDraft,
  recommendedIntent,
  type SolutionDraft,
} from "@/lib/solutionDraft";

export type SituationDoor = "assessment" | "contact" | "booking";

export type SituationDoorCopy = {
  headline: string;
  detail: string;
  continueLabel: string;
  continueHref: string;
  privacy: string;
};

const PRIVACY = "Remembered on this device only. No name, email, or phone.";

/** Project the live Solution Draft into the allow-listed anonymous situation. */
export function situationFromDraft(draft: SolutionDraft): AnonymousSituation | null {
  return parseAnonymousSituation({
    users: draft.environment.userCount,
    workstations: draft.environment.workstationCount,
    mobiles: draft.environment.mobileDeviceCount,
    sites: draft.environment.siteCount,
    deviceOwnership: draft.environment.deviceOwnership,
    internalIt: draft.environment.internalIt,
    needs: draft.needs.map((need) => ({
      familyId: need.familyId as SituationFamilyId,
      source: need.source,
    })),
    relationship: draft.deliveryPreference,
    installation: draft.fulfillment.installation,
    remoteSupport: draft.fulfillment.remoteSupport,
    intent: recommendedIntent(draft),
  });
}

export function readAnonymousSituation(): AnonymousSituation | null {
  if (typeof window === "undefined") return null;
  return situationFromDraft(readSolutionDraft());
}

/** Body field to POST with assessment/contact. Undefined when there is nothing to send. */
export function situationSubmitPayload(): { situation: AnonymousSituation } | Record<string, never> {
  const situation = readAnonymousSituation();
  return situation ? { situation } : {};
}

export function continueHrefForSituation(situation: AnonymousSituation): string {
  return situation.needs.length > 0 ? SOLUTION_WORKSPACE_PATH : BUSINESS_NEEDS_INDEX_PATH;
}

export function situationDoorCopy(situation: AnonymousSituation, door: SituationDoor): SituationDoorCopy {
  const line = situationPublicLine(situation);
  const continueHref = continueHrefForSituation(situation);
  const continueLabel = situation.needs.length > 0 ? "Continue your solution" : "Finish your Store profile";
  if (door === "assessment") {
    return {
      headline: "We'll size this assessment against the environment you already started.",
      detail: line
        ? `${line}. This form is another way in — you do not need to retype users, computers, or sites.`
        : "This form is another way in. Continue the solution you started, or send this assessment against that same environment.",
      continueLabel,
      continueHref,
      privacy: PRIVACY,
    };
  }
  if (door === "contact") {
    return {
      headline: "This is another way in — we already have your Store environment.",
      detail: line
        ? `${line}. Tell us what you want from this conversation, or continue the solution you started.`
        : "Tell us what you want from this conversation, or continue the solution you started.",
      continueLabel,
      continueHref,
      privacy: PRIVACY,
    };
  }
  return {
    headline: "We'll talk from the environment you already started in the Store.",
    detail: line
      ? `${line}. Mention it on the call, or send the package from the Store first.`
      : "Mention the Store solution on the call, or send the package first.",
    continueLabel,
    continueHref,
    privacy: PRIVACY,
  };
}

export function useAnonymousSituation(): AnonymousSituation | null {
  const draft = useSolutionDraft();
  return useMemo(() => situationFromDraft(draft), [draft]);
}

export { situationPublicLine, suggestedContactService };
export type { AnonymousSituation };
