export type ProfileEmailUpdateDecision =
  | { ok: true }
  | { ok: false; message: string };

export function validateProfileEmailUpdate(
  currentEmail: string,
  requestedEmail: unknown,
): ProfileEmailUpdateDecision {
  if (typeof requestedEmail !== "string") return { ok: true };
  if (requestedEmail.trim().toLowerCase() === currentEmail.trim().toLowerCase()) {
    return { ok: true };
  }
  return {
    ok: false,
    message:
      "Email changes require verified support. Submit a portal ticket to update the login address.",
  };
}
