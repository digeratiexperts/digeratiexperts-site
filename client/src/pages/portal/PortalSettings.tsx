import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalLayout } from "./PortalLayout";
import { User, Lock, Bell, Users } from "lucide-react";
import MfaSetup from "@/components/portal/MfaSetup";
import { portalFetch, portalGet, redirectToPortalLogin } from "@/lib/portalApi";
import { requiresPortalReauthentication } from "@/lib/portalSensitiveAction";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type ProfileManager = { id: string; email: string; fullName: string };

const managedNotifications = [
  {
    title: "Ticket Updates",
    description: "Updates and replies for your support requests",
    testId: "notification-ticket-updates",
  },
  {
    title: "Invoice Alerts",
    description: "New invoices, payment reminders, and billing notices",
    testId: "notification-invoice-alerts",
  },
  {
    title: "Service Updates",
    description: "Maintenance, incidents, and important service announcements",
    testId: "notification-service-updates",
  },
] as const;

export default function PortalSettings() {
  const { toast } = useToast();
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("portalUser");
    return stored ? JSON.parse(stored) : {};
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
      if (requiresPortalReauthentication(data)) {
        redirectToPortalLogin("/portal/settings");
        return;
      }
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
    <PortalLayout title="Settings">
      <div className="space-y-6 max-w-2xl">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#D3126A]" />
              <div>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  placeholder="Your name"
                  data-testid="input-fullname"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  value={formData.email}
                  readOnly
                  aria-describedby="login-email-help"
                  data-testid="input-email"
                />
                <p id="login-email-help" className="text-xs text-muted-foreground">
                  This is your verified login address. To change it securely, submit a support ticket so we
                  can verify the request before updating access.
                </p>
              </div>
              <Button
                type="submit"
                className="bg-[#D3126A] hover:bg-[#D3126A]/90"
                data-testid="button-save-profile"
                disabled={savingProfile}
              >
                {savingProfile ? "Saving…" : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#D3126A]" />
              <div>
                <CardTitle>Your manager (profile)</CardTitle>
                <CardDescription>
                  Used for Access Request approvals. Manager email on forms must match this person and your
                  company domain
                  {companyDomains.length ? ` (${companyDomains.join(", ")})` : ""}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {manager ? (
              <>
                <p className="font-medium">{manager.fullName}</p>
                <p className="text-muted-foreground font-mono text-xs">{manager.email}</p>
              </>
            ) : (
              <p className="text-muted-foreground">
                No manager assigned on your profile yet. Ask your Company IT Contact to set one under People
                & Org.
              </p>
            )}
            <Link href="/portal/people" className="text-[#D3126A] text-sm font-medium hover:underline inline-block mt-1">
              Open People & Org
            </Link>
          </CardContent>
        </Card>

        {/* Password Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#D3126A]" />
              <div>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Password</label>
                <Input
                  type="password"
                  value={passwordData.current}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      current: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                  data-testid="input-current-password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  value={passwordData.new}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, new: e.target.value })
                  }
                  placeholder="••••••••"
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={passwordData.confirm}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirm: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                  data-testid="input-confirm-password"
                />
              </div>
              <Button
                type="submit"
                className="bg-[#D3126A] hover:bg-[#D3126A]/90"
                data-testid="button-change-password"
                disabled={savingPassword}
              >
                {savingPassword ? "Updating…" : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#D3126A]" />
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Required account and service notifications remain enabled. Support can help with delivery
                  changes.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ul className="space-y-3" aria-label="Enabled notification categories">
                {managedNotifications.map((notification) => (
                  <li
                    key={notification.title}
                    className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-3 dark:bg-slate-800"
                    data-testid={notification.testId}
                  >
                    <div>
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{notification.description}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                      aria-label={`${notification.title} notifications are enabled`}
                    >
                      On
                    </span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/portal/tickets/create" data-testid="link-request-notification-change">
                  Request notification changes
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                This portal does not yet offer self-service notification controls. A support request keeps
                changes verified and tied to your account.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <MfaSetup />
      </div>
    </PortalLayout>
  );
}
