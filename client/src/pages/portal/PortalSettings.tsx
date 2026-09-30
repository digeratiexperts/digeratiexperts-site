import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalLayout } from "./PortalLayout";
import { User, Lock, Bell, Users } from "lucide-react";
import MfaSetup from "@/components/portal/MfaSetup";
import { portalFetch, portalGet } from "@/lib/portalApi";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type ProfileManager = { id: string; email: string; fullName: string };

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
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="your@email.com"
                  data-testid="input-email"
                />
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
                <CardDescription>Manage your notification preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div>
                  <label htmlFor="checkbox-ticket-updates" className="font-medium text-sm">Ticket Updates</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notifications when tickets are updated
                  </p>
                </div>
                <input id="checkbox-ticket-updates" type="checkbox" defaultChecked className="h-4 w-4 accent-[#D3126A]" data-testid="checkbox-ticket-updates" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div>
                  <label htmlFor="checkbox-invoice-alerts" className="font-medium text-sm">Invoice Alerts</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notifications for new invoices
                  </p>
                </div>
                <input id="checkbox-invoice-alerts" type="checkbox" defaultChecked className="h-4 w-4 accent-[#D3126A]" data-testid="checkbox-invoice-alerts" />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div>
                  <label htmlFor="checkbox-service-updates" className="font-medium text-sm">Service Updates</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notifications for service announcements
                  </p>
                </div>
                <input id="checkbox-service-updates" type="checkbox" defaultChecked className="h-4 w-4 accent-[#D3126A]" data-testid="checkbox-service-updates" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication */}
        <MfaSetup />
      </div>
    </PortalLayout>
  );
}
