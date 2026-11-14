import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, ShieldOff, Smartphone, Mail, Copy, Key, AlertTriangle, CheckCircle2, Loader } from "lucide-react";
import { portalGet, portalPost, redirectToPortalLogin } from "@/lib/portalApi";
import { requiresPortalReauthentication } from "@/lib/portalSensitiveAction";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MfaStatus {
  mfaEnabled: boolean;
  mfaMethod: "totp" | "email" | null;
  backupCodesRemaining: number;
}

export default function MfaSetup() {
  const { toast } = useToast();
  const [setupStep, setSetupStep] = useState<"choose" | "totp" | "email" | "confirm" | null>(null);
  const [setupData, setSetupData] = useState<any>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [reauthenticateAfterBackupCodes, setReauthenticateAfterBackupCodes] = useState(false);
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
      setReauthenticateAfterBackupCodes(requiresPortalReauthentication(data));
      setSetupStep(null);
      setSetupData(null);
      setVerifyCode("");
      if (!requiresPortalReauthentication(data)) {
        queryClient.invalidateQueries({ queryKey: ["/api/portal/mfa/status"] });
      }
      toast({ title: "MFA Enabled", description: "Two-factor authentication is now active on your account." });
    },
    onError: (err: any) => {
      toast({ title: "Verification Failed", description: err.message || "Invalid code", variant: "destructive" });
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => portalPost("/api/portal/mfa/disable", { password: disablePassword }),
    onSuccess: (data: unknown) => {
      setDisableDialog(false);
      setDisablePassword("");
      if (requiresPortalReauthentication(data)) {
        redirectToPortalLogin("/portal/settings");
        return;
      }
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
      setReauthenticateAfterBackupCodes(requiresPortalReauthentication(data));
      setRegenDialog(false);
      setRegenPassword("");
      if (!requiresPortalReauthentication(data)) {
        queryClient.invalidateQueries({ queryKey: ["/api/portal/mfa/status"] });
      }
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

  const closeBackupCodes = () => {
    setBackupCodes(null);
    if (reauthenticateAfterBackupCodes) {
      setReauthenticateAfterBackupCodes(false);
      redirectToPortalLogin("/portal/settings");
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="flex items-center justify-center py-8">
          <Loader className="h-6 w-6 animate-spin text-de-magenta-ink" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-de-magenta-ink" />
              <div>
                <CardTitle className="text-white text-lg">Two-Factor Authentication</CardTitle>
                <CardDescription className="text-gray-400">
                  Add an extra layer of security to your account
                </CardDescription>
              </div>
            </div>
            {status?.mfaEnabled ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Enabled</Badge>
            ) : (
              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Disabled</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {status?.mfaEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">MFA is active</p>
                  <p className="text-xs text-gray-400">
                    Method: {status.mfaMethod === "totp" ? "Authenticator App" : "Email Verification"}
                    {status.backupCodesRemaining > 0 && ` · ${status.backupCodesRemaining} backup codes remaining`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRegenDialog(true)}
                  className="border-white/20 text-white hover:bg-white/10"
                  data-testid="button-regen-backup"
                >
                  <Key className="mr-2 h-4 w-4" />
                  New Backup Codes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisableDialog(true)}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  data-testid="button-disable-mfa"
                >
                  <ShieldOff className="mr-2 h-4 w-4" />
                  Disable MFA
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {setupStep === null ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => { setSetupStep("totp"); setupMutation.mutate("totp"); }}
                    className="p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-left"
                    data-testid="button-setup-totp"
                  >
                    <Smartphone className="h-6 w-6 text-de-magenta-ink mb-2" />
                    <p className="text-sm font-medium text-white">Authenticator App</p>
                    <p className="text-xs text-gray-400 mt-1">Use Google Authenticator, Authy, or Microsoft Authenticator</p>
                  </button>
                  <button
                    onClick={() => { setSetupStep("email"); setupMutation.mutate("email"); }}
                    className="p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-left"
                    data-testid="button-setup-email"
                  >
                    <Mail className="h-6 w-6 text-de-magenta-ink mb-2" />
                    <p className="text-sm font-medium text-white">Email Verification</p>
                    <p className="text-xs text-gray-400 mt-1">Receive a code via email each time you log in</p>
                  </button>
                </div>
              ) : setupStep === "confirm" && setupData ? (
                <div className="space-y-4">
                  {setupData.method === "totp" && setupData.qrCode && (
                    <div className="text-center space-y-3">
                      <p className="text-sm text-gray-300">Scan this QR code with your authenticator app:</p>
                      <img src={setupData.qrCode} alt="TOTP QR Code" className="mx-auto w-48 h-48 rounded-lg" data-testid="img-totp-qr" />
                      <p className="text-xs text-gray-500">
                        Or enter manually: <code className="bg-white/10 px-2 py-1 rounded text-de-magenta-ink">{setupData.secret}</code>
                      </p>
                    </div>
                  )}
                  {setupData.method === "email" && (
                    <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      A verification code has been sent to your email.
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">Enter Verification Code</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      className="bg-white/10 border-white/20 text-white text-center text-lg tracking-widest"
                      autoFocus
                      data-testid="input-setup-code"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => confirmMutation.mutate()}
                      disabled={verifyCode.length < 6 || confirmMutation.isPending}
                      className="flex-1 bg-[#D3126A] hover:bg-[#e01874]"
                      data-testid="button-confirm-setup"
                    >
                      {confirmMutation.isPending ? "Verifying..." : "Enable MFA"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setSetupStep(null); setSetupData(null); setVerifyCode(""); }}
                      className="border-white/20 text-white hover:bg-white/10"
                      data-testid="button-cancel-setup"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <Loader className="h-6 w-6 animate-spin text-de-magenta-ink" />
                  <span className="ml-2 text-gray-400 text-sm">Setting up...</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Codes Modal */}
      <Dialog open={!!backupCodes} onOpenChange={(open) => { if (!open) closeBackupCodes(); }}>
        <DialogContent className="bg-[#0f0d2e] border-white/20 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-de-magenta-ink" />
              Backup Codes
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Save these codes in a secure place. Each code can only be used once.
              {reauthenticateAfterBackupCodes && " You will sign in again after closing this window."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 p-4 bg-white/5 rounded-lg font-mono">
            {backupCodes?.map((code, i) => (
              <div key={i} className="text-center py-1.5 bg-white/10 rounded text-sm text-de-magenta-ink" data-testid={`text-backup-code-${i}`}>
                {code}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-300">These codes won't be shown again. Save them now.</p>
          </div>
          <DialogFooter>
            <Button onClick={copyBackupCodes} variant="outline" className="border-white/20 text-white hover:bg-white/10" data-testid="button-copy-codes">
              <Copy className="mr-2 h-4 w-4" />
              Copy All
            </Button>
            <Button onClick={closeBackupCodes} className="bg-[#D3126A] hover:bg-[#e01874]" data-testid="button-close-codes">
              I've Saved Them
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable MFA Dialog */}
      <Dialog open={disableDialog} onOpenChange={setDisableDialog}>
        <DialogContent className="bg-[#0f0d2e] border-white/20 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400">Disable Two-Factor Auth</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter your password to confirm disabling MFA.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Enter your password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            className="bg-white/10 border-white/20 text-white"
            data-testid="input-disable-password"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableDialog(false)} className="border-white/20 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => disableMutation.mutate()}
              disabled={!disablePassword || disableMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-disable"
            >
              {disableMutation.isPending ? "Disabling..." : "Disable MFA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Backup Codes Dialog */}
      <Dialog open={regenDialog} onOpenChange={setRegenDialog}>
        <DialogContent className="bg-[#0f0d2e] border-white/20 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Regenerate Backup Codes</DialogTitle>
            <DialogDescription className="text-gray-400">
              This will invalidate all existing backup codes. Enter your password to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Enter your password"
            value={regenPassword}
            onChange={(e) => setRegenPassword(e.target.value)}
            className="bg-white/10 border-white/20 text-white"
            data-testid="input-regen-password"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenDialog(false)} className="border-white/20 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => regenMutation.mutate()}
              disabled={!regenPassword || regenMutation.isPending}
              className="bg-[#D3126A] hover:bg-[#e01874]"
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
