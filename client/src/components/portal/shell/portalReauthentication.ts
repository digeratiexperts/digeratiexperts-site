import { portalGet } from "@/lib/portalApi";

/** A second tab may restore this cookie, but must never swap the draft's owner. */
export async function verifyPortalReauthentication(expectedUserId: string): Promise<void> {
  const result = await portalGet<{ user?: { id?: string } }>("/api/portal/me");
  if (!expectedUserId || result.user?.id !== expectedUserId) {
    throw new Error("Sign in with the same account to continue this draft.");
  }
}
