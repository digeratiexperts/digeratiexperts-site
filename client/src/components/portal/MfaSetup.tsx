import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ShieldOff, Smartphone, Mail, Copy, Key, Loader, KeyRound, Laptop, ShieldCheck, Building2, Trash2, Plus } from "lucide-react";
import { portalGet, portalPost } from "@/lib/portalApi";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Callout, Field, Panel, Token } from "@/components/portal/ui";
import {
  createPasskey,
  detectPlatform,
  passkeyErrorMessage,
  passkeysSupported,
  type PasskeyProvider,
} from "@/lib/webauthn";

interface PasskeySummary {
  id: string;
  nickname: string;
  provider: PasskeyProvider | "other";
  providerLabel: string;
  synced: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface MfaStatus {
  mfaEnabled: boolean;
  mfaMethod: "totp" | "email" | "passkey" | null;
  backupCodesRemaining: number;
  passkeys?: PasskeySummary[];
}

type ProviderCard = {
  id: PasskeyProvider;
  title: string;
  icon: typeof Smartphone;
  summary: string;
  steps: string[];
  /** These two are third-party providers: offer the 6-digit code path as well. */
  codeFallback?: string;
};

const PROVIDERS: ProviderCard[] = [
  {
    id: "apple",
    title: "Apple",
    icon: Laptop,
    summary: "iPhone, iPad or Mac. Face ID or Touch ID, saved to iCloud Keychain.",
    steps: [
      "Needs iOS 16, iPadOS 16 or macOS Ventura or later, with iCloud Keychain on.",
      "On your iPhone, iPad or Mac: confirm with Face ID or Touch ID when asked.",
      "On a Windows or Android computer: scan the QR code with your iPhone camera.",
    ],
  },
  {
    id: "android",
    title: "Android",
    icon: Smartphone,
    summary: "Fingerprint, face or screen lock, saved to Google Password Manager.",
    steps: [
      "Needs Android 9 or later with a screen lock set.",
      "On your Android phone: confirm with your fingerprint, face or screen lock.",
      "On a computer: scan the QR code with your Android phone and keep Bluetooth on.",
    ],
  },
  {
    id: "microsoft",
    title: "Microsoft Authenticator",
    icon: ShieldCheck,
    summary: "Save the passkey in the Authenticator app on your phone.",
    steps: [
      "iPhone: Settings › General › AutoFill & Passwords, then turn on Authenticator.",
      "Android: Settings › Passwords, passkeys & accounts, then choose Authenticator.",
      "When the phone asks where to save the passkey, pick Authenticator.",
      "If Authenticator isn't offered for this site, use the 6-digit code option below.",
    ],
    codeFallback: "Use a 6-digit code in Microsoft Authenticator instead",
  },
  {
    id: "jumpcloud",
    title: "JumpCloud",
    icon: Building2,
    summary: "Save the passkey in JumpCloud Password Manager.",
    steps: [
      "Sign in to JumpCloud Password Manager on your phone or install its browser extension.",
      "iPhone: Settings › General › AutoFill & Passwords, then turn on JumpCloud.",
      "Android: Settings › Passwords, passkeys & accounts, then choose JumpCloud.",
      "When asked where to save the passkey, pick JumpCloud.",
    ],
    codeFallback: "Use a 6-digit code in an authenticator app instead",
  },
];

const PANEL_TITLE = "Two-factor authentication";
const PANEL_DESCRIPTION = "Add an extra layer of security to your account";
const SECONDARY = "min-h-11 border-border bg-card hover:bg-accent";
const CARD =
  "min-h-11 rounded-lg border border-border bg-card p-4 text-left text-card-foreground transition-colors pt-hover-brand hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

function methodLabel(method: MfaStatus["mfaMethod"]): string {
  if (method === "totp") return "Authenticator app";
  if (method === "email") return "Email";
  if (method === "passkey") return "Passkey";
  return "On";
}

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
  const [selectedProvider, setSelectedProvider] = useState<PasskeyProvider | null>(null);
  const [showAddPasskey, setShowAddPasskey] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<PasskeySummary | null>(null);
  const [removePassword, setRemovePassword] = useState("");

  const canUsePasskeys = passkeysSupported();
  const providers = useMemo(() => {
    const mine = detectPlatform();
    return mine ? [...PROVIDERS].sort((a, b) => (a.id === mine ? -1 : b.id === mine ? 1 : 0)) : PROVIDERS;
  }, []);

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
      // Back to the method picker; leaving the step set kept the spinner up forever.
      setSetupStep(null);
      setSetupData(null);
      toast({ title: "Setup Failed", description: err.message || "Could not start MFA setup", variant: "destructive" });
    },
  });

  const passkeyMutation = useMutation({
    mutationFn: async (provider: PasskeyProvider) => {
      const start: any = await portalPost("/api/portal/mfa/passkey/register/options", { provider });
      let credential: Record<string, unknown>;
      try {
        credential = await createPasskey(start.options);
      } catch (err: any) {
        throw new Error(passkeyErrorMessage(err));
      }
      return portalPost("/api/portal/mfa/passkey/register/verify", { setupToken: start.setupToken, credential });
    },
    onSuccess: (data: any) => {
      setSelectedProvider(null);
      setShowAddPasskey(false);
      if (data?.backupCodes) setBackupCodes(data.backupCodes);
      queryClient.invalidateQueries({ queryKey: ["/api/portal/mfa/status"] });
      toast({
        title: "Passkey saved",
        description: `${data?.passkey?.providerLabel || "Your passkey"} will be asked for when you sign in.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Passkey not saved", description: err.message || "Passkey setup failed", variant: "destructive" });
    },
  });

  const removePasskeyMutation = useMutation({
    mutationFn: () => portalPost("/api/portal/mfa/passkey/remove", { id: removeTarget?.id, password: removePassword }),
    onSuccess: (data: any) => {
      setRemoveTarget(null);
      setRemovePassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/portal/mfa/status"] });
      toast({
        title: "Passkey removed",
        description: data?.mfaEnabled ? "It can no longer sign in to your account." : "That was your last passkey, so MFA is now off.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message || "Could not remove passkey", variant: "destructive" });
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

  const passkeys = status?.passkeys || [];
  const statusToken = status?.mfaEnabled ? (
    <Token tone="ok" dot label={`On · ${methodLabel(status.mfaMethod)}`} />
  ) : (
    <Token tone="neutral" label="Off" />
  );

  const startCodeSetup = () => {
    setSelectedProvider(null);
    setSetupStep("totp");
    setupMutation.mutate("totp");
  };

  const providerPicker = (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Passkey (recommended)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Phishing-resistant. Nothing to type: confirm with your face, fingerprint or PIN.
        </p>
      </div>
      {!canUsePasskeys && (
        <Callout tone="warn">This browser doesn't support passkeys. Update it, or use a 6-digit code below.</Callout>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {providers.map((p) => {
          const Icon = p.icon;
          const active = selectedProvider === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!canUsePasskeys || passkeyMutation.isPending}
              onClick={() => setSelectedProvider(active ? null : p.id)}
              aria-pressed={active}
              className={`${CARD} ${active ? "ring-2 ring-ring" : ""}`}
              data-testid={`button-passkey-${p.id}`}
            >
              <Icon className="pt-link mb-2 h-6 w-6" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">{p.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{p.summary}</p>
            </button>
          );
        })}
      </div>

      {selectedProvider && (() => {
        const p = PROVIDERS.find((x) => x.id === selectedProvider)!;
        return (
          <div className="space-y-3 rounded-lg border border-border bg-background p-4" data-testid={`panel-passkey-${p.id}`}>
            <p className="text-sm font-medium text-foreground">Set up with {p.title}</p>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              {p.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="brand"
                className="min-h-11"
                onClick={() => passkeyMutation.mutate(p.id)}
                disabled={passkeyMutation.isPending}
                data-testid="button-create-passkey"
              >
                {passkeyMutation.isPending ? (
                  <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                )}
                {passkeyMutation.isPending ? "Waiting for your device…" : "Create passkey"}
              </Button>
              {p.codeFallback && !status?.mfaEnabled && (
                <Button variant="outline" className={SECONDARY} onClick={startCodeSetup} data-testid={`button-code-${p.id}`}>
                  {p.codeFallback}
                </Button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );

  const passkeyList = passkeys.length > 0 && (
    <ul className="divide-y divide-border rounded-lg border border-border" data-testid="list-passkeys">
      {passkeys.map((pk) => (
        <li key={pk.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              <KeyRound className="pt-link mr-2 inline h-4 w-4" aria-hidden="true" />
              {pk.nickname}
            </p>
            <p className="text-xs text-muted-foreground">
              {pk.providerLabel}
              {pk.synced ? " · synced" : " · this device only"}
              {" · added "}
              {new Date(pk.createdAt).toLocaleDateString()}
              {pk.lastUsedAt ? ` · last used ${new Date(pk.lastUsedAt).toLocaleDateString()}` : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className={`${SECONDARY} min-w-11 shrink-0`}
            onClick={() => setRemoveTarget(pk)}
            aria-label={`Remove passkey ${pk.nickname}`}
            data-testid={`button-remove-passkey-${pk.id}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <Panel id="settings-mfa" title={PANEL_TITLE} description={PANEL_DESCRIPTION} actions={statusToken}>
        {status?.mfaEnabled ? (
          <div className="space-y-4">
            <Callout tone="ok" title="MFA is active">
              Method: {methodLabel(status.mfaMethod)}
              {passkeys.length > 0 && status.mfaMethod !== "passkey" && (
                <> · {passkeys.length} passkey{passkeys.length === 1 ? "" : "s"}</>
              )}
              {status.backupCodesRemaining > 0 && (
                <>
                  {" · "}
                  <span className="pt-num">{status.backupCodesRemaining}</span> backup codes remaining
                </>
              )}
            </Callout>

            {passkeyList}

            {showAddPasskey ? (
              providerPicker
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowAddPasskey(true)}
                className={SECONDARY}
                disabled={!canUsePasskeys}
                data-testid="button-add-passkey"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {passkeys.length > 0 ? "Add another passkey" : "Add a passkey"}
              </Button>
            )}

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
              <div className="space-y-5">
                {providerPicker}
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-sm font-medium text-foreground">Or use a code</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={startCodeSetup}
                      className={CARD}
                      data-testid="button-setup-totp"
                    >
                      <Smartphone className="pt-link mb-2 h-6 w-6" aria-hidden="true" />
                      <p className="text-sm font-medium text-foreground">Authenticator App</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Microsoft Authenticator, Google Authenticator, Authy, or Apple Passwords
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSetupStep("email"); setupMutation.mutate("email"); }}
                      className={CARD}
                      data-testid="button-setup-email"
                    >
                      <Mail className="pt-link mb-2 h-6 w-6" aria-hidden="true" />
                      <p className="text-sm font-medium text-foreground">Email Verification</p>
                      <p className="mt-1 text-xs text-muted-foreground">Receive a code via email each time you log in</p>
                    </button>
                  </div>
                </div>
              </div>
            ) : setupStep === "confirm" && setupData ? (
              <div className="space-y-4">
                {setupData.method === "totp" && setupData.qrCode && (
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-foreground">Scan this QR code with your authenticator app:</p>
                    <img src={setupData.qrCode} alt="TOTP QR Code" className="mx-auto h-48 w-48 rounded-lg bg-white" data-testid="img-totp-qr" />
                    {setupData.otpauthUrl && (
                      <p className="text-xs">
                        <a href={setupData.otpauthUrl} className="pt-link underline" data-testid="link-open-authenticator">
                          On this phone? Open in your authenticator app
                        </a>
                      </p>
                    )}
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
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
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

      {/* Remove Passkey Dialog */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open) { setRemoveTarget(null); setRemovePassword(""); } }}>
        <DialogContent className="max-w-sm border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="pt-ink pt-tone-bad h-5 w-5" aria-hidden="true" />
              Remove passkey
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {removeTarget?.nickname} will no longer sign in to this account. Also delete it from{" "}
              {removeTarget?.providerLabel} on your device. Enter your password to confirm.
            </DialogDescription>
          </DialogHeader>
          <Field label="Password" htmlFor="passkey-remove-password">
            <Input
              id="passkey-remove-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={removePassword}
              onChange={(e) => setRemovePassword(e.target.value)}
              className="min-h-11 border-border bg-background"
              data-testid="input-remove-passkey-password"
            />
          </Field>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRemoveTarget(null)} className={SECONDARY}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removePasskeyMutation.mutate()}
              disabled={!removePassword || removePasskeyMutation.isPending}
              className="min-h-11"
              data-testid="button-confirm-remove-passkey"
            >
              {removePasskeyMutation.isPending ? "Removing..." : "Remove passkey"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
