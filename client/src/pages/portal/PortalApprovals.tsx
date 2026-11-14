import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, AlertCircle, Clock, ArrowLeft } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { canApprovals, readPortalUser } from "@/lib/portalRoles";

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

const statusColor = (status: string) => {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "info_requested":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-yellow-100 text-yellow-800";
  }
};

export function PortalApprovals() {
  const user = readPortalUser();
  const [scope, setScope] = useState<"mine" | "team" | "company">("mine");
  const [items, setItems] = useState<Approval[]>([]);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/approvals?scope=${scope}`, {
        credentials: "include",
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
        credentials: "include",
        headers: {
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

  return (
    <PortalLayout title="Approvals">
      <div className="max-w-5xl mx-auto space-y-4">
        <p className="text-sm text-slate-600">
          Access and spend-style requests route to your manager, optional skip-level (high priority or
          $1,000+), then your Department or Company IT Contact before Digerati fulfills the work.
        </p>

        {showQueues && (
          <div className="flex flex-wrap gap-2">
            {(["mine", "team", "company"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={scope === s ? "default" : "outline"}
                onClick={() => setScope(s)}
              >
                {s === "mine" ? "My queue" : s === "team" ? "Team" : "Company"}
              </Button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {selected ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => setSelected(null)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back to Approvals
                </Button>
                <CardTitle>{selected.title}</CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {selected.requestNumber} · {selected.type}
                </p>
              </div>
              <Badge className={statusColor(selected.status)}>{selected.status.replace("_", " ")}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">Requested by</span>
                  <p className="font-medium">{selected.requesterName || "—"}</p>
                </div>
                <div>
                  <span className="text-slate-500">Priority</span>
                  <p className="font-medium uppercase">{selected.priority}</p>
                </div>
                {typeof selected.amountCents === "number" && (
                  <div>
                    <span className="text-slate-500">Amount</span>
                    <p className="font-medium">${(selected.amountCents / 100).toLocaleString()}</p>
                  </div>
                )}
                {selected.noManagerAssigned && (
                  <div className="sm:col-span-2 text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    No manager was assigned on the requester — routed to IT Contact.
                  </div>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{selected.description}</p>

              <div>
                <h3 className="font-semibold mb-2">
                  Approval status (
                  {selected.steps.filter((s) => s.status === "approved").length}/{selected.steps.length})
                </h3>
                <ul className="space-y-2">
                  {selected.steps.map((step) => (
                    <li
                      key={step.id}
                      className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{step.approverName || "Unassigned"}</p>
                        <p className="text-slate-500 capitalize">{step.stepType.replace("_", " ")}</p>
                      </div>
                      <Badge className={statusColor(step.status)}>
                        {step.status === "approved" && <CheckCircle className="w-3 h-3 mr-1" />}
                        {step.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                        {step.status === "rejected" && <AlertCircle className="w-3 h-3 mr-1" />}
                        {step.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>

              {selected.status === "pending" || selected.status === "info_requested" ? (
                <div className="space-y-3 border-t pt-4">
                  <label className="text-sm font-medium" htmlFor="approval-note">
                    Note (optional)
                  </label>
                  <Textarea
                    id="approval-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Add context for the requester or next approver"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={acting}
                      onClick={() => act("approve")}
                    >
                      Approve
                    </Button>
                    <Button variant="outline" disabled={acting} onClick={() => act("reject")}>
                      Reject
                    </Button>
                    <Button variant="outline" disabled={acting} onClick={() => act("request-info")}>
                      Request Info
                    </Button>
                  </div>
                </div>
              ) : null}

              {selected.fulfillmentTicketId && (
                <p className="text-sm text-slate-600">
                  Fulfillment ticket created for Digerati after final approval.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {loading && <p className="text-sm text-slate-500">Loading approvals…</p>}
            {!loading && items.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-slate-600">
                  No approval requests in this queue yet. Access requests from Request Forms enter the
                  manager → IT Contact workflow automatically.
                </CardContent>
              </Card>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left"
                onClick={() => setSelected(item)}
              >
                <Card className="hover:border-fuchsia-300 transition-colors">
                  <CardContent className="py-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-sm text-slate-500">
                        {item.requestNumber} · {item.type} · {item.requesterName}
                      </p>
                    </div>
                    <Badge className={statusColor(item.status)}>{item.status.replace("_", " ")}</Badge>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export default PortalApprovals;
