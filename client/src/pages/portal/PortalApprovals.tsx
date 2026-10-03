import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { canApprovals, readPortalUser } from "@/lib/portalRoles";
import { cn } from "@/lib/utils";
import { Callout, EmptyState, Field, GenericStatus, Panel, Priority, Token } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";

type Step = {
  id: string;
  stepOrder: number;
  stepType: string;
  status: string;
  approverName?: string | null;
  note?: string | null;
};

type Approval = {
  id: string;
  requestNumber: string;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  amountCents?: number | null;
  requesterName?: string;
  noManagerAssigned?: boolean;
  fulfillmentTicketId?: string | null;
  createdAt: string;
  steps: Step[];
};

const SCOPES: { value: "mine" | "team" | "company"; label: string }[] = [
  { value: "mine", label: "My queue" },
  { value: "team", label: "Team" },
  { value: "company", label: "Company" },
];

/** `info_requested` has no entry in the shared vocabulary; everything else maps through GenericStatus. */
function ApprovalStatus({ status }: { status: string }) {
  if (status === "info_requested") return <Token label="Info requested" tone="info" dot />;
  return <GenericStatus status={status} />;
}

export function PortalApprovals() {
  const user = readPortalUser();
  const [scope, setScope] = useState<"mine" | "team" | "company">("mine");
  const [items, setItems] = useState<Approval[]>([]);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const token = () => localStorage.getItem("portalToken") || "";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/approvals?scope=${scope}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load approvals");
      setItems(data.approvals || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [scope]);

  const act = async (action: "approve" | "reject" | "request-info") => {
    if (!selected) return;
    setActing(true);
    try {
      const res = await fetch(`/api/portal/approvals/${selected.id}/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setNote("");
      setSelected(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActing(false);
    }
  };

  const showQueues = canApprovals(user);

  const approvedSteps = selected ? selected.steps.filter((s) => s.status === "approved").length : 0;
  const canAct = selected ? selected.status === "pending" || selected.status === "info_requested" : false;

  return (
    <PortalLayout
      title="Approvals"
      description="Access and spend-style requests route to your manager, optional skip-level (high priority or $1,000+), then your Department or Company IT Contact before DE fulfills the work."
      width="wide"
    >
      <div className="space-y-4">
        {showQueues && !selected && (
          <div role="group" aria-label="Approval queue" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
            {SCOPES.map((s) => {
              const active = scope === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setScope(s.value)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                  data-testid={`button-scope-${s.value}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <Callout tone="bad" title="Something needs attention" testId="approvals-error">
            {error}
          </Callout>
        )}

        {selected ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <Panel
                id="approval-detail"
                title={selected.title}
                description={
                  <span className="inline-flex flex-wrap items-center gap-x-2">
                    <span className="pt-num">{selected.requestNumber}</span>
                    <span>· {selected.type}</span>
                  </span>
                }
                actions={
                  <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => setSelected(null)} data-testid="button-back-to-approvals">
                    Back to Approvals
                  </Button>
                }
              >
                <div className="space-y-4">
                  {selected.noManagerAssigned && (
                    <Callout tone="warn">No manager was assigned on the requester — routed to IT Contact.</Callout>
                  )}
                  <p className="whitespace-pre-wrap text-sm">{selected.description}</p>
                  {selected.fulfillmentTicketId && (
                    <Callout tone="ok">Fulfillment ticket created for DE after final approval.</Callout>
                  )}
                </div>
              </Panel>

              {canAct && (
                <Panel id="approval-decision" title="Your decision">
                  <div className="space-y-4">
                    <Field label="Note (optional)" htmlFor="approval-note" hint="Add context for the requester or next approver">
                      <Textarea
                        id="approval-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        placeholder="Add context for the requester or next approver"
                        className="border-border bg-background"
                        data-testid="textarea-approval-note"
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button variant="brand" disabled={acting} onClick={() => act("approve")} data-testid="button-approve">
                        Approve
                      </Button>
                      <Button variant="outline" className="border-border bg-card hover:bg-accent" disabled={acting} onClick={() => act("reject")} data-testid="button-reject">
                        Reject
                      </Button>
                      <Button variant="outline" className="border-border bg-card hover:bg-accent" disabled={acting} onClick={() => act("request-info")} data-testid="button-request-info">
                        Request Info
                      </Button>
                    </div>
                  </div>
                </Panel>
              )}
            </div>

            <div className="space-y-4">
              <Panel id="approval-summary" title="Details">
                <dl className="space-y-3 text-sm">
                  {[
                    ["Status", <ApprovalStatus key="s" status={selected.status} />],
                    ["Priority", <Priority key="p" priority={selected.priority} />],
                    ["Requested by", selected.requesterName || "—"],
                    ...(typeof selected.amountCents === "number"
                      ? [["Amount", <span key="a" className="pt-num">${(selected.amountCents / 100).toLocaleString()}</span>] as const]
                      : []),
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>

              <Panel id="approval-steps" title="Approval status" description={`${approvedSteps}/${selected.steps.length} approved`} flush>
                <ul className="divide-y divide-border">
                  {selected.steps.map((step) => (
                    <li key={step.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm md:px-5">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{step.approverName || "Unassigned"}</p>
                        <p className="capitalize text-xs text-muted-foreground">{step.stepType.replace("_", " ")}</p>
                      </div>
                      <ApprovalStatus status={step.status} />
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        ) : (
          <Panel
            id="approvals-list"
            title={SCOPES.find((s) => s.value === scope)?.label ?? "My queue"}
            description={loading ? "Loading…" : `${items.length} request${items.length === 1 ? "" : "s"}`}
            flush
          >
            {loading ? (
              <div className="divide-y divide-border" aria-busy="true" aria-live="polite">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="ml-auto h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No approval requests in this queue yet"
                description="Access requests from Request Forms enter the manager → IT Contact workflow automatically."
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id} data-testid={`approval-row-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:px-5"
                      data-testid={`button-open-approval-${item.id}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span className="pt-num">{item.requestNumber}</span>
                          <span>· {item.type}</span>
                          {item.requesterName && <span>· {item.requesterName}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <Priority priority={item.priority} className="hidden sm:inline-flex" />
                        <ApprovalStatus status={item.status} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </PortalLayout>
  );
}

export default PortalApprovals;
