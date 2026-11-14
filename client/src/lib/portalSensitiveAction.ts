export function requiresPortalReauthentication(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return (value as { reauthenticationRequired?: unknown }).reauthenticationRequired === true;
}
