import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "./PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { portalGet } from "@/lib/portalApi";
import { Activity, Bot, DoorOpen, RefreshCw, ShieldAlert, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "wouter";

type Knock = {
  id: string;
  kind: string;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  path: string | null;
  isBotLikely: boolean;
  botReason: string | null;
  createdAt: string;
};

type Summary = {
  sinceHours: number;
  total: number;
  bots: number;
  humans: number;
  failed: number;
  success: number;
  pageHits: number;
  uniqueIps: number;
  topIps: Array<{ ip: string; count: number; bots: number }>;
};

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    page_hit: "Knock (page)",
    login_failed: "Failed login",
    login_success: "Success",
    mfa_failed: "MFA failed",
    mfa_success: "MFA ok",
    zoho_start: "Zoho start",
    zoho_failed: "Zoho failed",
    turnstile_failed: "Bot check failed",
    locked_out: "Locked out",
  };
  return map[kind] || kind;
}

function kindTone(kind: string): "default" | "secondary" | "destructive" | "outline" {
  if (kind.includes("fail") || kind === "locked_out" || kind === "turnstile_failed") return "destructive";
  if (kind.includes("success")) return "default";
  if (kind === "page_hit") return "secondary";
  return "outline";
}

export function AdminLoginKnocks() {
  const [hours, setHours] = useState(24);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    summary: Summary;
    knocks: Knock[];
  }>({
    queryKey: ["/api/portal/admin/login-knocks", hours],
    queryFn: () => portalGet(`/api/portal/admin/login-knocks?hours=${hours}`),
    refetchInterval: 30_000,
  });

  const summary = data?.summary;
  const knocks = data?.knocks || [];
  const alertHot = (summary?.failed || 0) >= 10 || (summary?.bots || 0) >= 15;

  return (
    <PortalLayout title="Login Door Alerts" description="Who hits the portal login: page loads, failures, successes and bot-like signals.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div />
          <div className="flex flex-wrap items-center gap-2">
            {[24, 72, 168].map((h) => (
              <Button
                key={h}
                size="sm"
                variant={hours === h ? "default" : "outline"}
                onClick={() => setHours(h)}
              >
                {h === 168 ? "7d" : `${h}h`}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/portal/admin/lifecycle">Lifecycle APIs</Link>
            </Button>
          </div>
        </div>

        {alertHot && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 flex gap-3 items-start">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Elevated login pressure</p>
              <p className="text-sm text-amber-800 dark:text-amber-200/90">
                {summary?.failed || 0} failed attempts and {summary?.bots || 0} bot-likely knocks in the last{" "}
                {summary?.sinceHours || hours}h. Review top IPs below.
              </p>
            </div>
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error instanceof Error ? error.message : "Failed to load knocks"}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat icon={<DoorOpen className="h-4 w-4" />} label="Total knocks" value={summary?.total} />
          <Stat icon={<Activity className="h-4 w-4" />} label="Page hits" value={summary?.pageHits} />
          <Stat icon={<ShieldAlert className="h-4 w-4 text-red-500" />} label="Failed" value={summary?.failed} />
          <Stat icon={<UserRound className="h-4 w-4 text-emerald-600" />} label="Success" value={summary?.success} />
          <Stat icon={<Bot className="h-4 w-4" />} label="Bot-likely" value={summary?.bots} />
          <Stat icon={<Activity className="h-4 w-4" />} label="Unique IPs" value={summary?.uniqueIps} />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top IPs</CardTitle>
              <CardDescription>Who is knocking most often</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!isLoading && !summary?.topIps?.length && (
                <p className="text-sm text-muted-foreground">No knocks in this window yet.</p>
              )}
              {summary?.topIps?.map((row) => (
                <div key={row.ip} className="flex items-center justify-between text-sm border-b border-border/60 py-2 last:border-0">
                  <span className="font-mono text-xs truncate max-w-[60%]">{row.ip}</span>
                  <div className="flex items-center gap-2">
                    {row.bots > 0 && <Badge variant="destructive">{row.bots} bot</Badge>}
                    <Badge variant="secondary">{row.count}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Live feed</CardTitle>
              <CardDescription>Auto-refreshes every 30 seconds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[520px] overflow-auto divide-y divide-border/60">
                {isLoading && <p className="text-sm text-muted-foreground py-4">Loading…</p>}
                {!isLoading && knocks.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">
                    Quiet door — open the login page or attempt a sign-in to see knocks here.
                  </p>
                )}
                {knocks.map((k) => (
                  <div key={k.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                    <div className="sm:w-40 shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {new Date(k.createdAt).toLocaleString()}
                      </p>
                      <Badge variant={kindTone(k.kind)} className="mt-1">
                        {kindLabel(k.kind)}
                      </Badge>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium truncate">{k.email || "—"}</p>
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {k.ip || "unknown ip"} · {k.path || "/portal/login"}
                      </p>
                      {k.isBotLikely && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Bot-likely{k.botReason ? `: ${k.botReason}` : ""}
                        </p>
                      )}
                      {k.userAgent && (
                        <p className="text-sm text-muted-foreground truncate" title={k.userAgent}>
                          {k.userAgent}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value?: number;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
      </CardContent>
    </Card>
  );
}

export default AdminLoginKnocks;
