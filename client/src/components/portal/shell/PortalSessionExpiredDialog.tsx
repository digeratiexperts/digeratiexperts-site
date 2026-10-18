import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { portalLoginWithReturn } from "@/lib/portalUrls";
import { verifyPortalReauthentication } from "./portalReauthentication";

export function PortalSessionExpiredDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  useEffect(() => {
    const expired = () => setOpen(true);
    window.addEventListener("de-portal-session-expired", expired);
    return () => window.removeEventListener("de-portal-session-expired", expired);
  }, []);
  async function resume() {
    setChecking(true);
    setError("");
    try {
      await verifyPortalReauthentication(userId);
      setOpen(false);
      void queryClient.invalidateQueries();
    } catch (cause) {
      setError(cause instanceof Error && /same account/.test(cause.message)
        ? cause.message : "Sign-in is not restored yet. Sign in, then try again.");
    } finally { setChecking(false); }
  }
  return <AlertDialog open={open}>
    <AlertDialogContent data-testid="portal-session-expired-dialog">
      <AlertDialogHeader>
        <AlertDialogTitle>Sign in again to continue</AlertDialogTitle>
        <AlertDialogDescription>Your session ended. Keep this page open to preserve unsaved work. Sign in with the same account in a new tab, then return here.</AlertDialogDescription>
      </AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter>
        <Button variant="outline" asChild><a href={portalLoginWithReturn("/portal")} target="_blank" rel="noopener noreferrer">Sign in in a new tab</a></Button>
        <Button onClick={() => void resume()} disabled={checking}>{checking ? "Checking…" : "I've signed in"}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
