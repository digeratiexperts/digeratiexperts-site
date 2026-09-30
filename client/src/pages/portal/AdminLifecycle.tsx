import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalLayout } from "./PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { portalGet, portalPost } from "@/lib/portalApi";
import { Link } from "wouter";
import { useState } from "react";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type IntegrationStatus = {
  configured: boolean;
  success: boolean;
  message: string;
  endpoint?: string;
};

type LifecycleEvent = {
  id: string;
  action: "onboard" | "offboard";
  email: string;
  companyName: string | null;
  jumpcloud: Record<string, unknown>;
  blackpoint: Record<string, unknown>;
  success: boolean;
  requestedBy: string | null;
  createdAt: string;
};

export function AdminLifecycle() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [deleteJc, setDeleteJc] = useState(false);
  const [lastResult, setLastResult] = useState<LifecycleEvent | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<{
    status: { jumpcloud: IntegrationStatus; blackpoint: IntegrationStatus };
    events: LifecycleEvent[];
  }>({
    queryKey: ["/api/portal/admin/lifecycle/status"],
    queryFn: () => portalGet("/api/portal/admin/lifecycle/status"),
  });

  const onboard = useMutation({
    mutationFn: () =>
      portalPost<{ success: boolean; event: LifecycleEvent }>("/api/portal/admin/lifecycle/onboard", {
        email,
        companyName,
        firstName,
        lastName,
      }),
    onSuccess: (res) => {
      setLastResult(res.event);
      qc.invalidateQueries({ queryKey: ["/api/portal/admin/lifecycle/status"] });
    },
  });

  const offboard = useMutation({
    mutationFn: () =>
      portalPost<{ success: boolean; event: LifecycleEvent }>("/api/portal/admin/lifecycle/offboard", {
        email,
        companyName,
        deleteJumpCloudUser: deleteJc,
      }),
    onSuccess: (res) => {
      setLastResult(res.event);
      qc.invalidateQueries({ queryKey: ["/api/portal/admin/lifecycle/status"] });
    },
  });

  const jc = data?.status.jumpcloud;
  const bp = data?.status.blackpoint;

  return (
    <PortalLayout title="Onboard / Offboard" description="API-connected onboarding and offboarding for the directory (JumpCloud) and MDR (Blackpoint Cyber).">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Test connections
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/portal/admin/login-knocks">Login alerts</Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <StatusCard
            title="JumpCloud"
            loading={isLoading}
            status={jc}
            hint="Uses JUMPCLOUD_API_KEY (optional JUMPCLOUD_ORG_ID). Creates / unsuspends on onboard; suspends (or deletes) on offboard."
          />
          <StatusCard
            title="Blackpoint Cyber"
            loading={isLoading}
            status={bp}
            hint="Uses BLACKPOINT_API_KEY (or BLACKPOINT_API_TOKEN). Matches tenant by company name; returns agent install / offboard checklist. Optional BLACKPOINT_INSTALLER_URL."
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Run lifecycle</CardTitle>
            <CardDescription>Requires DE admin. Keys stay in server env — never paste secrets here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lc-email">Work email</Label>
                <Input
                  id="lc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@client.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-company">Company (Blackpoint tenant match)</Label>
                <Input
                  id="lc-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Dental"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-first">First name</Label>
                <Input id="lc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lc-last">Last name</Label>
                <Input id="lc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={deleteJc} onChange={(e) => setDeleteJc(e.target.checked)} />
              Offboard: delete JumpCloud user (default is suspend)
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onboard.mutate()}
                disabled={!email || onboard.isPending}
              >
                {onboard.isPending ? "Onboarding…" : "Onboard"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => offboard.mutate()}
                disabled={!email || offboard.isPending}
              >
                {offboard.isPending ? "Offboarding…" : "Offboard"}
              </Button>
            </div>
            {(onboard.isError || offboard.isError) && (
              <p className="text-sm text-red-600">
                {(onboard.error || offboard.error) instanceof Error
                  ? ((onboard.error || offboard.error) as Error).message
                  : "Request failed"}
              </p>
            )}
            {lastResult && (
              <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto max-h-64">
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent runs</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/60">
            {!data?.events?.length && (
              <p className="text-sm text-muted-foreground py-2">No lifecycle runs yet.</p>
            )}
            {data?.events?.map((ev) => (
              <div key={ev.id} className="py-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ev.action === "onboard" ? "default" : "destructive"}>{ev.action}</Badge>
                    <span className="text-sm font-medium">{ev.email}</span>
                    {ev.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ev.companyName || "—"} · {new Date(ev.createdAt).toLocaleString()}
                    {ev.requestedBy ? ` · by ${ev.requestedBy}` : ""}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground max-w-md text-right">
                  JC: {String(ev.jumpcloud.message || "—")} · BP: {String(ev.blackpoint.message || "—")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

function StatusCard({
  title,
  status,
  loading,
  hint,
}: {
  title: string;
  status?: IntegrationStatus;
  loading: boolean;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {loading ? (
            <Badge variant="outline">…</Badge>
          ) : !status?.configured ? (
            <Badge variant="secondary">Not configured</Badge>
          ) : status.success ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Connected</Badge>
          ) : (
            <Badge variant="destructive">Error</Badge>
          )}
        </div>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{status?.message || (loading ? "Checking…" : "—")}</p>
        {status?.endpoint && (
          <p className="text-xs text-muted-foreground mt-1 font-mono">{status.endpoint}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminLifecycle;
