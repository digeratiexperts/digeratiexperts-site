import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, CircleDashed, Loader2, MinusCircle, ShieldCheck, XCircle, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { portalGet } from "@/lib/portalApi";
import { formatDeskTimestamp } from "@/lib/deskTimestamp";
import { cn } from "@/lib/utils";
import { Panel, Token, type TokenTone } from "@/components/portal/ui";
import { provisioningIsLive, type ProvisioningState, type ProvisioningSummary } from "@shared/provisioning";

/** Faster while something is being set up, slower once everything has settled. */
export const PROVISIONING_POLL_LIVE_MS = 10_000;
export const PROVISIONING_POLL_IDLE_MS = 60_000;

export const provisioningLabel: Record<ProvisioningState | "offboarded", { label: string; tone: TokenTone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  succeeded: { label: "Provisioned", tone: "ok" },
  failed: { label: "Failed", tone: "bad" },
  skipped: { label: "Skipped", tone: "neutral" },
  offboarded: { label: "Offboarded", tone: "warn" },
};

const stepIcon: Record<ProvisioningState, { icon: LucideIcon; tone: string }> = {
  not_started: { icon: CircleDashed, tone: "text-muted-foreground" },
  in_progress: { icon: Loader2, tone: "pt-ink pt-tone-info" },
  succeeded: { icon: CheckCircle2, tone: "pt-ink pt-tone-ok" },
  failed: { icon: XCircle, tone: "pt-ink pt-tone-bad" },
  skipped: { icon: MinusCircle, tone: "text-muted-foreground" },
};

const stepWord: Record<ProvisioningState, string> = {
  not_started: "not started",
  in_progress: "in progress",
  succeeded: "succeeded",
  failed: "failed",
  skipped: "skipped",
};

type ProfileProvisioning = ProvisioningSummary & { checkedAt: string };

/** The signed-in user's own provisioning, shown on Settings (their profile). */
export function ProvisioningStatusPanel() {
  const { data, isLoading, isError, dataUpdatedAt } = useQuery<ProfileProvisioning>({
    queryKey: ["/api/portal/profile/provisioning"],
    queryFn: () => portalGet<ProfileProvisioning>("/api/portal/profile/provisioning"),
    refetchInterval: (query) => (provisioningIsLive(query.state.data) ? PROVISIONING_POLL_LIVE_MS : PROVISIONING_POLL_IDLE_MS),
    refetchOnWindowFocus: true,
  });
  const live = provisioningIsLive(data);
  const overall = data ? provisioningLabel[data.overall] : null;

  return (
    <Panel
      id="settings-provisioning"
      category="account"
      icon={ShieldCheck}
      title="Account provisioning"
      description="What DE has set up for you: your JumpCloud sign-in, Blackpoint protection and any Store orders being set up."
      actions={overall ? <Token label={overall.label} tone={overall.tone} dot={live} /> : undefined}
    >
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="text-sm text-muted-foreground">Provisioning status is unavailable right now. It refreshes on its own; if it stays this way, open a ticket.</p>
      ) : (
        <div aria-live="polite">
          <ul className="divide-y divide-border">
            {data.steps.map((step) => {
              const { icon: Icon, tone } = stepIcon[step.state];
              return (
                <li key={step.key} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0" data-testid={`provisioning-step-${step.key}`} data-state={step.state}>
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone, step.state === "in_progress" && "motion-safe:animate-spin")} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {step.label}
                      <span className="sr-only">: {stepWord[step.state]}</span>
                    </p>
                    <p className="mt-0.5 break-words text-xs text-muted-foreground">{step.detail}</p>
                  </div>
                  <Token label={provisioningLabel[step.state].label} tone={provisioningLabel[step.state].tone} className="shrink-0" />
                </li>
              );
            })}
          </ul>
          {data.orders.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Orders being set up">
              {data.orders.map((o) => (
                <li key={o.id}>
                  <Link href={o.detailPath} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="pt-num">{o.orderNumber}</span>
                    <Token label={o.status} tone={provisioningLabel[o.state].tone} className="px-1.5 py-0 text-[9px]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {data.lastRunAt ? `Last ${data.lastAction === "offboard" ? "offboard" : "onboard"} run ${formatDeskTimestamp(data.lastRunAt)}. ` : "DE hasn't run account onboarding for you yet. "}
            {live ? "Live, refreshing every 10 seconds" : "Refreshes every minute"}
            {dataUpdatedAt ? `; last checked ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}.` : "."}
          </p>
        </div>
      )}
    </Panel>
  );
}
