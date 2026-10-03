import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ShieldOff, Smartphone, Mail, Copy, Key, Loader } from "lucide-react";
import { portalGet, portalPost } from "@/lib/portalApi";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Callout, Field, Panel, Token } from "@/components/portal/ui";

interface MfaStatus {
  mfaEnabled: boolean;
  mfaMethod: "totp" | "email" | null;
  backupCodesRemaining: number;
}

const PANEL_TITLE = "Two-factor authentication";
const PANEL_DESCRIPTION = "Add an extra layer of security to your account";
const SECONDARY = "min-h-11 border-border bg-card hover:bg-accent";

export default function MfaSetup() {
  const { toast } = useToast();
  const [setupStep, setSetupStep] = useState<"choose" | "totp" | "email" | "confirm" | null>(null);
  const [setupData, setSetupData] = useState<any>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableDialog, setDisableDialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [regenDialog, setRegenDialog] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");

  const { data: status, isLoading } = useQuery<MfaStatus>({
    queryKey: ["/api/portal/mfa/status"],
    queryFn: () => portalGet("/api/portal/mfa/status"),
  });

  const setupMutation = useMutation({
    mutationFn: (method: string) => portalPost("/api/portal/mfa/setup", { method }),
    onSuccess: (data: any) => {
      setSetupData(data);
      setSetupStep("confirm");
    },
    onError: (err: any) => {
      toast({ title: "Setup Failed", description: err.message || "Could not start MFA setup", variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => portalPost("/api/portal/mfa/confirm", {
      setupToken: setupData?.setupToken,
      code: verifyCode,
      method: setupData?.method,
    }),
    onSuccess: (data: any) => {
      setBackupCodes(data.backupCodes);
      setSetupStep(null);
      setSetupData(null);
      setVerifyCode("");
      queryClient.invalidateQueries({ queryKey: ["/api/portal/mfa/status"] });
      toast({ title: "MFA Enabled", description: "Two-factor authentication is now active on your account." });
    },
    onError: (err: any) => {
      toast({ title: "Verification Failed", description: err.message || "Invalid code", variant: "destructive" });
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => portalPost("/api/portal/mfa/disable", { password: disablePassword }),
    onSuccess: () => {
      setDisableDialog(false);
      setDisablePassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/portal/mfa/status"] });
      toast({ title: "MFA Disabled", description: "Two-factor authentication has been removed." });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message || "Could not disable MFA", variant: "destructive" });
    },
  });

  const regenMutation = useMutation({
    mutationFn: () => portalPost("/api/portal/mfa/regenerate-backup-codes", { password: regenPassword }),
    onSuccess: (data: any) => {
      setBackupCodes(data.backupCodes);
      setRegenDialog(false);
      setRegenPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/portal/mfa/status"] });
      toast({ title: "Backup Codes Regenerated", description: "Save your new backup codes now." });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message || "Could not regenerate codes", variant: "destructive" });
    },
  });

  const copyBackupCodes = () => {
    if (backupCodes) {
      navigator.clipboard.writeText(backupCodes.join("\n"));
      toast({ title: "Copied", description: "Backup codes copied to clipboard." });
    }
  };

  if (isLoading) {
    return (
      <Panel id="settings-mfa" title={PANEL_TITLE} description={PANEL_DESCRIPTION}>
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader className="pt-link h-5 w-5 animate-spin" aria-hidden="true" />
          Loading two-factor status…
        </div>
      </Panel>
    );
  }

  const statusToken = status?.mfaEnabled ? (
    <Token
      tone="ok"
      dot
      label={
        status.mfaMethod === "totp" ? "On · Authenticator app" : status.mfaMethod === "email" ? "On · Email" : "On"
      }
    />
  ) : (
    <Token tone="neutral" label="Off" />
  );

  return (
    <>
      <Panel id="settings-mfa" title={PANEL_TITLE} description={PANEL_DESCRIPTION} actions={statusToken}>
        {status?.mfaEnabled ? (
          <div className="space-y-4">
            <Callout tone="ok" title="MFA is active">
              Method: {status.mfaMethod === "totp" ? "Authenticator App" : "Email Verification"}
              {status.backupCodesRemaining > 0 && (
                <>
                  {" · "}
                  <span className="pt-num">{status.backupCodesRemaining}</span> backup codes remaining
                </>
              )}
            </Callout>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                onClick={() => setRegenDialog(true)}
                className={SECONDARY}
                data-testid="button-regen-backup"
              >
                <Key className="h-4 w-4" aria-hidden="true" />
                New Backup Codes
              </Button>
              <Button
                variant="outline"
                onClick={() => setDisableDialog(true)}
                className={SECONDARY}
                data-testid="button-disable-mfa"
              >
                <ShieldOff className="pt-ink pt-tone-bad h-4 w-4" aria-hidden="true" />
                Disable MFA
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {setupStep === null ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => { setSetupStep("totp"); setupMutation.mutate("totp"); }}
                  className="min-h-11 rounded-lg border border-border bg-card p-4 text-left text-card-foreground transition-colors pt-hover-brand hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="button-setup-totp"
                >
                  <Smartphone className="pt-link mb-2 h-6 w-6" aria-hidden="true" />
                  <p className="text-sm font-medium text-foreground">Authenticator App</p>
                  <p className="mt-1 text-xs text-muted-foreground">Use Google Authenticator, Authy, or Microsoft Authenticator</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setSetupStep("email"); setupMutation.mutate("email"); }}
                  className="min-h-11 rounded-lg border border-border bg-card p-4 text-left text-card-foreground transition-colors pt-hover-brand hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="button-setup-email"
                >
                  <Mail className="pt-link mb-2 h-6 w-6" aria-hidden="true" />
                  <p className="text-sm font-medium text-foreground">Email Verification</p>
                  <p className="mt-1 text-xs text-muted-foreground">Receive a code via email each time you log in</p>
                </button>
              </div>
            ) : setupStep === "confirm" && setupData ? (
              <div className="space-y-4">
                {setupData.method === "totp" && setupData.qrCode && (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-foreground">Scan this QR code with your authenticator app:</p>
                    <img src={setupData.qrCode} alt="TOTP QR Code" className="mx-auto h-48 w-48 rounded-lg" data-testid="img-totp-qr" />
                    <p className="text-xs text-muted-foreground">
                      Or enter manually:{" "}
                      <code className="pt-link break-all rounded border border-border bg-background px-2 py-1 font-mono">{setupData.secret}</code>
                    </p>
                  </div>
                )}
                {setupData.method === "email" && (
                  <Callout tone="info">A verification code has been sent to your email.</Callout>
                )}
                <Field label="Enter Verification Code" htmlFor="mfa-setup-code">
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    className="pt-num min-h-11 border-border bg-background text-center text-lg tracking-widest"
                    id="mfa-setup-code"
                    autoFocus
                    data-testid="input-setup-code"
                  />
                </Field>
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    variant="brand"
                    onClick={() => confirmMutation.mutate()}
                    disabled={verifyCode.length < 6 || confirmMutation.isPending}
                    className="min-h-11 flex-1"
                    data-testid="button-confirm-setup"
                  >
                    {confirmMutation.isPending ? "Verifying..." : "Enable MFA"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setSetupStep(null); setSetupData(null); setVerifyCode(""); }}
                    className={SECONDARY}
                    data-testid="button-cancel-setup"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground" role="status" aria-live="polite">
                <Loader className="pt-link h-5 w-5 animate-spin" aria-hidden="true" />
                <span>Setting up...</span>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Backup Codes Modal */}
      <Dialog open={!!backupCodes} onOpenChange={() => setBackupCodes(null)}>
        <DialogContent className="max-w-md border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="pt-link h-5 w-5" aria-hidden="true" />
              Backup Codes
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Save these codes in a secure place. Each code can only be used once.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-num grid grid-cols-2 gap-2 rounded-lg border border-border bg-background p-4 font-mono">
            {backupCodes?.map((code, i) => (
              <div key={i} className="rounded border border-border bg-card py-1.5 text-center text-sm text-foreground" data-testid={`text-backup-code-${i}`}>
                {code}
              </div>
            ))}
          </div>
          <Callout tone="warn" role="alert" title="These codes won't be shown again. Save them now." />
          <DialogFooter className="gap-2">
            <Button onClick={copyBackupCodes} variant="outline" className={SECONDARY} data-testid="button-copy-codes">
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy All
            </Button>
            <Button onClick={() => setBackupCodes(null)} variant="brand" className="min-h-11" data-testid="button-close-codes">
              I've Saved Them
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable MFA Dialog */}
      <Dialog open={disableDialog} onOpenChange={setDisableDialog}>
        <DialogContent className="max-w-sm border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="pt-ink pt-tone-bad h-5 w-5" aria-hidden="true" />
              Disable Two-Factor Auth
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter your password to confirm disabling MFA.
            </DialogDescription>
          </DialogHeader>
          <Field label="Password" htmlFor="mfa-disable-password">
            <Input
              id="mfa-disable-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="min-h-11 border-border bg-background"
              data-testid="input-disable-password"
            />
          </Field>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDisableDialog(false)} className={SECONDARY}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => disableMutation.mutate()}
              disabled={!disablePassword || disableMutation.isPending}
              className="min-h-11"
              data-testid="button-confirm-disable"
            >
              {disableMutation.isPending ? "Disabling..." : "Disable MFA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Backup Codes Dialog */}
      <Dialog open={regenDialog} onOpenChange={setRegenDialog}>
        <DialogContent className="max-w-sm border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Regenerate Backup Codes</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will invalidate all existing backup codes. Enter your password to confirm.
            </DialogDescription>
          </DialogHeader>
          <Field label="Password" htmlFor="mfa-regen-password">
            <Input
              id="mfa-regen-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={regenPassword}
              onChange={(e) => setRegenPassword(e.target.value)}
              className="min-h-11 border-border bg-background"
              data-testid="input-regen-password"
            />
          </Field>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRegenDialog(false)} className={SECONDARY}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={() => regenMutation.mutate()}
              disabled={!regenPassword || regenMutation.isPending}
              className="min-h-11"
              data-testid="button-confirm-regen"
            >
              {regenMutation.isPending ? "Generating..." : "Generate New Codes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
