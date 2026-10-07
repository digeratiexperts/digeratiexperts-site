import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Callout, EmptyState, Panel, Token } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { portalFetch, portalGet } from "@/lib/portalApi";
import { cn } from "@/lib/utils";
import { ORDER_ACTOR_LABELS, type StoreOrderChangeRequest } from "@shared/storeOrderControls";
import { ClipboardList } from "lucide-react";

/**
 * DE admin: client requests to cancel a paid Store order or change an order.
 * DE applies the change (and any refund or re-quote) in the Store, then marks
 * the request done, or declines it with a reason the client sees.
 */

function RequestRow({ r }: { r: StoreOrderChangeRequest }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"done" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decide = async (decision: "done" | "declined") => {
    setBusy(decision);
    setError(null);
    const res = await portalFetch(`/api/portal/admin/order-requests/${encodeURIComponent(r.id)}`, { method: "POST", body: JSON.stringify({ decision, note }) });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body.error || "Couldn't save");
    void qc.invalidateQueries({ queryKey: ["/api/portal/admin/order-requests"] });
  };
  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/portal/orders/${r.orderId}`} className="pt-num font-semibold text-[hsl(var(--primary))] hover:underline">
          {r.orderNumber}
        </Link>
        <Token label={r.kind === "cancel" ? "Cancel (paid)" : "Change"} tone={r.kind === "cancel" ? "bad" : "info"} />
        {r.status !== "open" && <Token label={r.status === "done" ? "Done" : "Declined"} tone={r.status === "done" ? "ok" : "neutral"} />}
        <span className="text-xs text-muted-foreground">
          {r.requestedBy.name} ({ORDER_ACTOR_LABELS[r.requestedBy.role]}) · {new Date(r.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{r.details}</p>
      {r.status === "open" ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1">
            <label htmlFor={`note-${r.id}`} className="sr-only">
              Note to the client
            </label>
            <input
              id={`note-${r.id}`}
              className="min-h-[40px] w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="Note to the client (required to decline)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <button type="button" disabled={busy !== null} onClick={() => void decide("done")} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy === "done" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Mark done
          </button>
          <button type="button" disabled={busy !== null || !note.trim()} onClick={() => void decide("declined")} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent disabled:opacity-50">
            {busy === "declined" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Decline
          </button>
        </div>
      ) : (
        r.resolutionNote && (
          <p className="mt-1 text-xs text-muted-foreground">
            {r.resolvedByName}: {r.resolutionNote}
          </p>
        )
      )}
      {error && <Callout tone="bad" title={error} className="mt-2" />}
    </li>
  );
}

export default function AdminOrderRequests() {
  const [status, setStatus] = useState<"open" | "all">("open");
  const q = useQuery({
    queryKey: ["/api/portal/admin/order-requests", status],
    queryFn: () => portalGet<{ requests: StoreOrderChangeRequest[] }>(`/api/portal/admin/order-requests?status=${status}`),
  });
  return (
    <PortalLayout title="Order change requests" description="Client requests to cancel a paid order or change an order. Apply the change in the Store, then mark it done." width="wide">
      <div role="group" aria-label="Show" className="mb-4 flex gap-1.5">
        {(["open", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={cn("min-h-[36px] rounded-full border px-3 text-xs font-medium", status === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent")}
          >
            {s === "open" ? "Open" : "All"}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : q.isError ? (
        <Callout tone="bad" title="Requests couldn't be loaded (DE admin only)" />
      ) : (
        <Panel id="order-requests" flush>
          {q.data!.requests.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nothing waiting" description="Client cancellation and change requests appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {q.data!.requests.map((r) => (
                <RequestRow key={r.id} r={r} />
              ))}
            </ul>
          )}
        </Panel>
      )}
    </PortalLayout>
  );
}
