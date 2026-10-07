import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { Callout, Panel } from "@/components/portal/ui";
import { RequestStatusToken } from "@/components/portal/requests/RequestStatusToken";
import { directoryApi } from "@/lib/directoryApi";
import { cn } from "@/lib/utils";
import { APPROVER_ROLE_LABELS, type ApprovalFlow, type ContactPlan } from "@shared/orgDirectory";
import { TYPE_LABELS, type ServiceRequestRecord } from "@shared/serviceRequests";

/**
 * Approve or reject a service request waiting on you (site / department
 * leader, backup, manager or IT contact). Any listed approver can decide;
 * a rejection needs a reason the requester will see.
 */
export function ApprovalDecision({ request, onDone }: { request: ServiceRequestRecord; onDone?: (r: ServiceRequestRecord) => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decide = async (decision: "approve" | "reject") => {
    setBusy(decision);
    setError(null);
    try {
      const { request: updated } = await directoryApi.decide(request.id, decision, note);
      void qc.invalidateQueries({ queryKey: ["/api/portal/service-requests/approvals"] });
      void qc.invalidateQueries({ queryKey: ["/api/portal/service-requests"] });
      onDone?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your decision");
    } finally {
      setBusy(null);
    }
  };
  const id = `decision-note-${request.id}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        Note <span className="font-normal text-muted-foreground">(required to reject)</span>
      </label>
      <textarea id={id} className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <Callout tone="bad" title={error} />}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void decide("approve")}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />} Approve
        </button>
        <button
          type="button"
          disabled={busy !== null || !note.trim()}
          onClick={() => void decide("reject")}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-border px-4 text-sm font-semibold hover:bg-accent disabled:opacity-50"
        >
          {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />} Reject
        </button>
      </div>
    </div>
  );
}

export function approvalSummary(flow: ApprovalFlow | undefined): string | null {
  if (!flow) return null;
  if (!flow.required) return flow.reason;
  if (flow.state === "pending") return `Waiting for ${flow.approvers.map((a) => `${a.name} (${APPROVER_ROLE_LABELS[a.role]})`).join(" or ")}`;
  const who = flow.decidedBy ? `${flow.decidedBy.name} (${APPROVER_ROLE_LABELS[flow.decidedBy.role]})` : "an approver";
  return `${flow.state === "approved" ? "Approved" : "Rejected"} by ${who}${flow.decidedAt ? ` on ${new Date(flow.decidedAt).toLocaleDateString()}` : ""}${flow.note ? `: ${flow.note}` : ""}`;
}

/** The "Service requests" section at the top of the Approvals page. */
export function ServiceRequestApprovals() {
  const q = useQuery({ queryKey: ["/api/portal/service-requests/approvals"], queryFn: directoryApi.approvals, retry: false });
  const [open, setOpen] = useState<string | null>(null);
  if (q.isLoading || q.isError || !q.data) return null;
  const { pending, decided } = q.data;
  if (!pending.length && !decided.length) return null;
  return (
    <Panel
      id="service-request-approvals"
      title="Service requests waiting for you"
      description="You approve these as the site or department leader, backup, manager or IT contact. DE starts work once one approver says yes."
      flush
    >
      {pending.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">Nothing waiting. Recent decisions are below.</p>
      ) : (
        <ul className="divide-y divide-border">
          {pending.map((r) => {
            const plan = r.payload.contactPlan as ContactPlan | undefined;
            const expanded = open === r.id;
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/portal/requests/${r.id}`} className="pt-num font-semibold text-[hsl(var(--primary))] hover:underline">
                      {r.number}
                    </Link>{" "}
                    <span className="font-medium">{TYPE_LABELS[r.type]}</span>
                    <p className="text-sm text-muted-foreground">
                      For {r.requestedFor.name}
                      {plan?.personId ? ` (${plan.personId})` : ""} · submitted by {r.submittedBy.name}
                      {r.submittedAt ? ` · ${new Date(r.submittedAt).toLocaleDateString()}` : ""}
                    </p>
                    {r.type === "license_request" && (
                      <p className="text-sm">
                        {String(r.payload.licenseName ?? "")} — {String(r.payload.businessJustification ?? "")}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : r.id)}
                    className={cn("min-h-[36px] rounded-md border px-3 text-sm font-medium", expanded ? "border-[hsl(var(--primary))]" : "border-border hover:bg-accent")}
                  >
                    {expanded ? "Close" : "Decide"}
                  </button>
                </div>
                {expanded && (
                  <div className="mt-3 max-w-xl">
                    <ApprovalDecision request={r} onDone={() => setOpen(null)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {decided.length > 0 && (
        <details className="border-t border-border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Your recent decisions ({decided.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/portal/requests/${r.id}`} className="pt-num text-[hsl(var(--primary))] hover:underline">
                  {r.number}
                </Link>
                <span>{r.requestedFor.name}</span>
                <RequestStatusToken status={r.status} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}
