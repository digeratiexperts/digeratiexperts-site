import { readPortalSessionForRecovery, resumeVerifiedPortalSubmission } from "@/lib/portalSubmission";

/** A second tab may restore this cookie, but must never swap the draft's owner. */
export async function verifyPortalReauthentication(expectedUserId: string): Promise<void> {
  const response = await readPortalSessionForRecovery();
  if (!response.ok) throw new Error(`Session verification failed (${response.status}).`);
  const result = await response.json() as { user?: { id?: string } };
  if (!expectedUserId || result.user?.id !== expectedUserId) {
    throw new Error("Sign in with the same account to continue this draft.");
  }
  resumeVerifiedPortalSubmission(response);
}
