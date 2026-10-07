import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Pencil, Play } from "lucide-react";
import { Callout, Panel } from "@/components/portal/ui";
import { srApi } from "@/lib/serviceRequestsApi";
import { cn } from "@/lib/utils";
import {
  AMENDABLE_STATUSES,
  HOLD_MAX_DAYS,
  STATUS_LABELS,
  TYPE_ROUTES,
  canHold,
  type ServiceRequestHold,
  type ServiceRequestRecord,
} from "@shared/serviceRequests";

/**
 * Amend, hold or resume a request. Holds last until a chosen date (up to
 * HOLD_MAX_DAYS) and the request resumes by itself on that date. The server
 * decides who may act: the requester, their leader or backup, the IT contact
 * or DE.
 */

const PRESETS = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "30 days" },
];

function plusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const control = "min-h-[40px] w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function HoldBanner({ r }: { r: ServiceRequestRecord }) {
  const hold = r.payload.hold as ServiceRequestHold | undefined;
  if (r.status !== "on_hold" || !hold) return null;
  return (
    <Callout tone="warn" title={`On hold until ${new Date(`${hold.until}T00:00:00`).toLocaleDateString()}`}>
      {hold.reason}
      <span className="block text-xs">
        Put on hold by {hold.by.name}. It goes back to “{STATUS_LABELS[hold.resumeStatus]}” on that date, or sooner if someone resumes it.
      </span>
    </Callout>
  );
}

export function RequestControls({ r }: { r: ServiceRequestRecord }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"idle" | "hold">("idle");
  const [preset, setPreset] = useState<number | "custom">(7);
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amendable = AMENDABLE_STATUSES.includes(r.status);
  const holdable = canHold(r.status);
  const onHold = r.status === "on_hold";
  if (!amendable && !holdable && !onHold) return null;

  const done = (u: ServiceRequestRecord) => {
    qc.setQueryData(["/api/portal/service-requests", r.id], { success: true, request: u });
    void qc.invalidateQueries({ queryKey: ["/api/portal/service-requests"] });
    setMode("idle");
    setReason("");
  };
  const act = async (fn: () => Promise<{ request: ServiceRequestRecord }>) => {
    setBusy(true);
    setError(null);
    try {
      done((await fn()).request);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };
  const until = preset === "custom" ? custom : plusDays(preset);

  return (
    <Panel id="request-controls" title="Manage this request">
      <div className="flex flex-wrap gap-2">
        {amendable && (
          <Link
            href={`${TYPE_ROUTES[r.type]}?amend=${encodeURIComponent(r.id)}`}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> Amend
          </Link>
        )}
        {holdable && mode === "idle" && (
          <button type="button" onClick={() => setMode("hold")} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent">
            <Pause className="h-4 w-4" aria-hidden="true" /> Put on hold
          </button>
        )}
        {onHold && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act(() => srApi.resume(r.id))}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />} Resume now
          </button>
        )}
      </div>
      {amendable && <p className="mt-2 text-xs text-muted-foreground">You can amend until the work is under way.</p>}

      {mode === "hold" && (
        <form
          className="mt-4 space-y-3 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => srApi.hold(r.id, until, reason));
          }}
        >
          <fieldset>
            <legend className="text-sm font-medium">For how long?</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  aria-pressed={preset === p.days}
                  onClick={() => setPreset(p.days)}
                  className={cn("min-h-[36px] rounded-full border px-3 text-xs font-medium", preset === p.days ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent")}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={preset === "custom"}
                onClick={() => setPreset("custom")}
                className={cn("min-h-[36px] rounded-full border px-3 text-xs font-medium", preset === "custom" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent")}
              >
                Until a date
              </button>
            </div>
          </fieldset>
          {preset === "custom" && (
            <div>
              <label htmlFor="hold-until" className="block text-sm font-medium">
                Hold until
              </label>
              <input id="hold-until" type="date" required min={plusDays(1)} max={plusDays(HOLD_MAX_DAYS)} className={control} value={custom} onChange={(e) => setCustom(e.target.value)} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Resumes by itself on {until ? new Date(`${until}T00:00:00`).toLocaleDateString() : "the date you choose"}. Up to {HOLD_MAX_DAYS} days.
          </p>
          <div>
            <label htmlFor="hold-reason" className="block text-sm font-medium">
              Why? <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <textarea id="hold-reason" required maxLength={500} className={cn(control, "min-h-[72px] py-2")} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !reason.trim() || !until} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Put on hold
            </button>
            <button type="button" onClick={() => setMode("idle")} className="min-h-[40px] rounded-md px-3 text-sm font-medium hover:bg-accent">
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <Callout tone="bad" title={error} className="mt-3" />}
    </Panel>
  );
}
