import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalLayout } from "./PortalLayout";
import MfaSetup from "@/components/portal/MfaSetup";
import { portalFetch, portalGet } from "@/lib/portalApi";
import { useToast } from "@/hooks/use-toast";
import { Field, Panel } from "@/components/portal/ui";

type ProfileManager = { id: string; email: string; fullName: string };

const NOTIFICATIONS: { id: string; label: string; hint: string }[] = [
  { id: "checkbox-ticket-updates", label: "Ticket updates", hint: "Notifications when tickets are updated" },
  { id: "checkbox-invoice-alerts", label: "Invoice alerts", hint: "Notifications for new invoices" },
  { id: "checkbox-service-updates", label: "Service updates", hint: "Notifications for service announcements" },
];

export default function PortalSettings() {
  const { toast } = useToast();
  const [user, setUser] = useState(() => {
    // Corrupt/legacy localStorage must never white-screen Settings
    // (error-sweep finding, 2026-08-31).
    try {
      const stored = localStorage.getItem("portalUser");
      return stored ? JSON.parse(stored) : {};
    } catch {
      localStorage.removeItem("portalUser");
      return {};
    }
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [manager, setManager] = useState<ProfileManager | null>(null);
  const [companyDomains, setCompanyDomains] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    fullName: user.fullName || "",
    email: user.email || "",
  });

  useEffect(() => {
    (async () => {
      try {
        const data = await portalGet<{
          fullName?: string;
          email?: string;
          manager?: ProfileManager | null;
          companyDomains?: string[];
        }>("/api/portal/profile");
        if (data.fullName || data.email) {
          setFormData((prev) => ({
            fullName: data.fullName || prev.fullName,
            email: data.email || prev.email,
          }));
        }
        setManager(data.manager || null);
        setCompanyDomains(data.companyDomains || []);
      } catch {
        /* keep localStorage snapshot */
      }
    })();
  }, []);

  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await portalFetch("/api/portal/profile", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update profile");
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("portalUser", JSON.stringify(data.user));
      }
      toast({ title: "Profile updated", description: "Your profile has been saved." });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message || "Could not update profile",
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      toast({
        title: "Passwords do not match",
        description: "New password and confirmation must match.",
        variant: "destructive",
      });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await portalFetch("/api/portal/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwordData.current,
          newPassword: passwordData.new,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to change password");
      setPasswordData({ current: "", new: "", confirm: "" });
      toast({ title: "Password updated", description: "Your password has been changed." });
    } catch (err: any) {
      toast({
        title: "Password change failed",
        description: err.message || "Could not change password",
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <PortalLayout title="Settings" description="Your profile, sign-in security and notification preferences." width="default">
      <div className="max-w-2xl space-y-4">
        <Panel id="settings-profile" title="Profile information" description="Update your personal details">
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <Field label="Full name" htmlFor="settings-fullname">
              <Input
                id="settings-fullname"
                autoComplete="name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Your name"
                className="border-border bg-background"
                data-testid="input-fullname"
              />
            </Field>
            <Field label="Email address" htmlFor="settings-email">
              <Input
                id="settings-email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your@email.com"
                className="border-border bg-background"
                data-testid="input-email"
              />
            </Field>
            <div className="border-t border-border pt-4">
              <Button type="submit" variant="brand" data-testid="button-save-profile" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel
          id="settings-manager"
          title="Your manager"
          description={`Used for Access Request approvals. Manager email on forms must match this person and your company domain${companyDomains.length ? ` (${companyDomains.join(", ")})` : ""}.`}
          actions={
            <Link href="/portal/people" className="text-sm font-medium pt-link hover:underline">
              Open People &amp; Org →
            </Link>
          }
        >
          {manager ? (
            <dl className="text-sm">
              <dt className="sr-only">Manager</dt>
              <dd className="font-medium">{manager.fullName}</dd>
              <dd className="mt-0.5 font-mono text-xs text-muted-foreground">{manager.email}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No manager assigned on your profile yet. Ask your Company IT Contact to set one under People &amp; Org.
            </p>
          )}
        </Panel>

        <Panel id="settings-password" title="Change password" description="Update your password to keep your account secure">
          <form onSubmit={handleChangePassword} className="space-y-5">
            <Field label="Current password" htmlFor="settings-current-password">
              <Input
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                value={passwordData.current}
                onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                placeholder="••••••••"
                className="border-border bg-background"
                data-testid="input-current-password"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="New password" htmlFor="settings-new-password">
                <Input
                  id="settings-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordData.new}
                  onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                  placeholder="••••••••"
                  className="border-border bg-background"
                  data-testid="input-new-password"
                />
              </Field>
              <Field label="Confirm new password" htmlFor="settings-confirm-password">
                <Input
                  id="settings-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordData.confirm}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  placeholder="••••••••"
                  className="border-border bg-background"
                  data-testid="input-confirm-password"
                />
              </Field>
            </div>
            <div className="border-t border-border pt-4">
              <Button type="submit" variant="brand" data-testid="button-change-password" disabled={savingPassword}>
                {savingPassword ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel id="settings-notifications" title="Notifications" description="Manage your notification preferences" flush>
          <ul className="divide-y divide-border">
            {NOTIFICATIONS.map((n) => (
              <li key={n.id}>
                <label htmlFor={n.id} className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 px-4 py-3 md:px-5">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.label}</span>
                    <span className="block text-xs text-muted-foreground">{n.hint}</span>
                  </span>
                  <input id={n.id} type="checkbox" defaultChecked className="h-4 w-4 shrink-0 accent-primary" data-testid={n.id} />
                </label>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Two-factor authentication: renders its own surface and dialogs. */}
        <MfaSetup />
      </div>
    </PortalLayout>
  );
}
