import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, Pause, Pencil, Play } from "lucide-react";
import { Callout, Panel, Token } from "@/components/portal/ui";
import { portalFetch } from "@/lib/portalApi";
import { cn } from "@/lib/utils";
import { ORDER_ACTOR_LABELS, type OrderAbilities, type StoreOrderChangeRequest, type StoreOrderHold } from "@shared/storeOrderControls";

/**
 * Cancel, amend or hold a Store order. Unpaid orders cancel straight away;
 * paid ones send a cancellation request to DE. Amendments are requests DE
 * applies (prices and payment stay with the Store). A hold pauses fulfilment
 * until a chosen date, then it carries on by itself.
 */

type Controls = {
  status: string | null;
  hold: StoreOrderHold | null;
  changeRequests: StoreOrderChangeRequest[];
  canAct: boolean;
  can: OrderAbilities;
  holdMaxDays: number;
};

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await portalFetch(url, body === undefined ? {} : { method: "POST", body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

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

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const btn = "inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent disabled:opacity-50";
const primary = "inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50";

function DurationPicker({ value, onChange, max, idPrefix }: { value: string; onChange: (v: string) => void; max: number; idPrefix: string }) {
  const [custom, setCustom] = useState(false);
  return (
    <fieldset>
      <legend className="text-sm font-medium">For how long?</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.filter((p) => p.days <= max).map((p) => {
          const v = plusDays(p.days);
          const on = !custom && value === v;
          return (
            <button
              key={p.days}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setCustom(false);
                onChange(v);
              }}
              className={cn("min-h-[36px] rounded-full border px-3 text-xs font-medium", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent")}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => setCustom(true)}
          className={cn("min-h-[36px] rounded-full border px-3 text-xs font-medium", custom ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent")}
        >
          Until a date
        </button>
      </div>
      {custom && (
        <div className="mt-2">
          <label htmlFor={`${idPrefix}-until`} className="block text-sm font-medium">
            Until
          </label>
          <input id={`${idPrefix}-until`} type="date" min={plusDays(1)} max={plusDays(max)} className={field} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {value ? `Carries on by itself on ${new Date(`${value}T00:00:00`).toLocaleDateString()}.` : "Choose how long."} Up to {max} days.
      </p>
    </fieldset>
  );
}

export function OrderControls({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const key = ["/api/portal/orders", orderId, "controls"];
  const q = useQuery({ queryKey: key, queryFn: () => call<Controls>(`/api/portal/orders/${encodeURIComponent(orderId)}/controls`), retry: false });
  const [mode, setMode] = useState<"idle" | "cancel" | "amend" | "hold">("idle");
  const [text, setText] = useState("");
  const [until, setUntil] = useState(plusDays(7));
  const [holdWhileReviewing, setHoldWhileReviewing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const c = q.data;
  if (!c) return null;

  const run = async (url: string, body: unknown, done: string) => {
    setBusy(true);
    setError(null);
    try {
      const out = await call<Controls & { cancelled?: boolean }>(url, body);
      qc.setQueryData(key, out);
      void qc.invalidateQueries({ queryKey: ["/api/portal/orders"] });
      setMode("idle");
      setText("");
      setMessage(out.cancelled ? "Order cancelled." : done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };
  const base = `/api/portal/orders/${encodeURIComponent(orderId)}`;
  const open = c.changeRequests.filter((r) => r.status === "open");

  return (
    <Panel id="order-controls" title="Change this order">
      {c.hold && (
        <Callout tone="warn" title={`On hold until ${new Date(`${c.hold.until}T00:00:00`).toLocaleDateString()}`} className="mb-3">
          {c.hold.reason}
          <span className="block text-xs">
            By {c.hold.by.name} ({ORDER_ACTOR_LABELS[c.hold.by.role]}). Fulfilment carries on by itself on that date.
          </span>
        </Callout>
      )}
      {message && <Callout tone="ok" title={message} className="mb-3" />}
      {c.can.note && <p className="mb-3 text-sm text-muted-foreground">{c.can.note}</p>}

      {c.canAct && mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          {(c.can.cancelNow || c.can.requestCancel) && (
            <button type="button" className={btn} onClick={() => setMode("cancel")}>
              <Ban className="h-4 w-4" aria-hidden="true" /> {c.can.cancelNow ? "Cancel order" : "Ask to cancel"}
            </button>
          )}
          {c.can.requestAmend && (
            <button type="button" className={btn} onClick={() => setMode("amend")}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> Ask for a change
            </button>
          )}
          {c.can.hold && (
            <button type="button" className={btn} onClick={() => setMode("hold")}>
              <Pause className="h-4 w-4" aria-hidden="true" /> Put on hold
            </button>
          )}
          {c.can.resume && (
            <button type="button" className={primary} disabled={busy} onClick={() => void run(`${base}/resume`, {}, "Hold lifted.")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />} Resume now
            </button>
          )}
        </div>
      )}
      {!c.canAct && <p className="text-sm text-muted-foreground">Only the person who ordered, their leader, your IT contact or DE can change this order.</p>}

      {mode !== "idle" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "cancel") void run(`${base}/cancel`, { reason: text }, "Cancellation request sent to DE.");
            if (mode === "amend") void run(`${base}/change-request`, { details: text, holdUntil: holdWhileReviewing && c.can.hold ? until : undefined }, "Change request sent to DE.");
            if (mode === "hold") void run(`${base}/hold`, { until, reason: text }, "Order on hold.");
          }}
        >
          <div>
            <label htmlFor="order-control-text" className="block text-sm font-medium">
              {mode === "cancel" ? "Why cancel?" : mode === "amend" ? "What should change?" : "Why hold it?"} <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <textarea id="order-control-text" required maxLength={mode === "amend" ? 4000 : 1000} className={cn(field, "min-h-[88px]")} value={text} onChange={(e) => setText(e.target.value)} />
            {mode === "cancel" && !c.can.cancelNow && <p className="mt-1 text-xs text-muted-foreground">This order is paid, so DE reviews the cancellation and any refund.</p>}
            {mode === "amend" && <p className="mt-1 text-xs text-muted-foreground">For example a different quantity, model or delivery address. DE confirms any price change before applying it.</p>}
          </div>
          {mode === "hold" && <DurationPicker value={until} onChange={setUntil} max={c.holdMaxDays} idPrefix="order-hold" />}
          {mode === "amend" && c.can.hold && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={holdWhileReviewing} onChange={(e) => setHoldWhileReviewing(e.target.checked)} /> Hold the order while DE reviews the change
              </label>
              {holdWhileReviewing && <DurationPicker value={until} onChange={setUntil} max={c.holdMaxDays} idPrefix="order-amend-hold" />}
            </>
          )}
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={busy || !text.trim() || (mode === "hold" && !until)}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode === "cancel" ? (c.can.cancelNow ? "Cancel order" : "Send request") : mode === "amend" ? "Send request" : "Put on hold"}
            </button>
            <button type="button" className="min-h-[40px] rounded-md px-3 text-sm font-medium hover:bg-accent" onClick={() => setMode("idle")}>
              Back
            </button>
          </div>
        </form>
      )}
      {error && <Callout tone="bad" title={error} className="mt-3" />}

      {c.changeRequests.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">Requests to DE{open.length ? ` (${open.length} open)` : ""}</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {c.changeRequests.map((r) => (
              <li key={r.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.kind === "cancel" ? "Cancel" : "Change"}</span>
                  <Token label={r.status === "open" ? "With DE" : r.status === "done" ? "Done" : "Declined"} tone={r.status === "open" ? "warn" : r.status === "done" ? "ok" : "bad"} />
                  <span className="text-xs text-muted-foreground">
                    {r.requestedBy.name} · {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground">{r.details}</p>
                {r.resolutionNote && (
                  <p className="text-xs">
                    {r.resolvedByName}: {r.resolutionNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
