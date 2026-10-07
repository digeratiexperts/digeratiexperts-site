import { useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Check, Loader2, Paperclip } from "lucide-react";
import { PortalLayout } from "../PortalLayout";
import { Callout, Panel } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestStatusToken } from "@/components/portal/requests/RequestStatusToken";
import { useInvalidateRequests } from "@/components/portal/requests/RequestCommon";
import { PortalHelpChat } from "@/components/portal/assist/PortalHelpChat";
import { portalFetch } from "@/lib/portalApi";
import { srApi } from "@/lib/serviceRequestsApi";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  TERMINAL_STATUSES,
  TIMELINE_BY_TYPE,
  TYPE_LABELS,
  USER_CANCELLABLE,
  returnReasonLabel,
  type ServiceRequestRecord,
} from "@shared/serviceRequests";
import { PORTAL_TICKET_ACCEPT } from "@shared/portalTicketFileRules";
import { accountTypeLabel, platformLabel } from "@shared/licensing";
import { APPROVER_ROLE_LABELS, type ApprovalFlow, type ContactPlan } from "@shared/orgDirectory";
import { ApprovalDecision, approvalSummary } from "@/components/portal/approvals/ServiceRequestApprovals";
import { readPortalUser } from "@/lib/portalRoles";
import { useQueryClient } from "@tanstack/react-query";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  if (children === undefined || children === null || children === "") return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function fieldRows(r: ServiceRequestRecord): Array<[string, ReactNode]> {
  const p = r.payload as Record<string, any>;
  const common: Array<[string, ReactNode]> = [
    ["Requested for", r.requestedFor.name],
    ["Submitted by", r.submittedBy.name],
    ["Contact phone", p.contactPhone],
  ];
  if (r.type === "license_request") {
    return [
      ["Requested for", r.requestedFor.name],
      ["Submitted by", r.submittedBy.name],
      ["Account", p.accountKind === "person" ? r.requestedFor.name : `${p.accountName} (${accountTypeLabel(String(p.accountKind))})`],
      ["Account type", `${accountTypeLabel(String(p.accountType))}${p.tier ? ` · ${p.tier}` : ""}`],
      ["Operation", p.operation === "remove" ? "Remove from licence group" : "Add to licence group"],
      ["Platform", platformLabel(String(p.platform))],
      ["Licence", p.licenseName],
      ["Group", p.group],
      ["Business justification", p.businessJustification],
    ];
  }
  if (r.type === "loaner_computer") {
    return [
      ...common,
      ["Device", p.deviceKind === "desktop" ? "Desktop" : "Laptop"],
      ["Needed from", p.neededFrom],
      ["Loan until", p.loanUntil],
      ["Accessories and peripherals", p.accessories],
      ["Reason", p.reason],
      ["Additional notes", p.additionalNotes],
    ];
  }
  const computer = p.asset
    ? [p.asset.assetTag, p.asset.model, p.asset.serialNumber ? `S/N ${p.asset.serialNumber}` : ""].filter(Boolean).join(" · ")
    : p.manualAsset
      ? `Not in assigned assets: ${[p.manualAsset.assetTag, p.manualAsset.serialNumber, p.manualAsset.description].filter(Boolean).join(" · ")}`
      : "";
  return [
    ...common,
    ["Reason for return", returnReasonLabel(String(p.returnReason), r.accountName)],
    ["Computer", computer],
    ["Accessories returned with it", p.accessories],
    ["Preferred return date", p.preferredReturnDate],
    ["Additional comments", p.additionalComments],
  ];
}

/** Status timeline: the happy path with reached steps checked, plus the event log. */
function Timeline({ r }: { r: ServiceRequestRecord }) {
  const reached = new Set(r.statusHistory.map((e) => e.status));
  // Requests that went through a leader's approval show that step first.
  const path = reached.has("pending_approval") || r.status === "pending_approval" ? ["pending_approval" as const, ...TIMELINE_BY_TYPE[r.type]] : TIMELINE_BY_TYPE[r.type];
  const stoppedAt = r.status === "rejected" || r.status === "cancelled" ? r.status : null;
  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-x-1 gap-y-3" aria-label="Progress">
        {path.map((s, i) => {
          const done = reached.has(s);
          const current = s === r.status;
          return (
            <li key={s} className="flex items-center gap-1" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  current
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] text-foreground"
                    : done
                      ? "border-border text-foreground"
                      : "border-dashed border-border text-muted-foreground",
                )}
              >
                {done && <Check className="h-3 w-3" aria-hidden="true" />}
                {STATUS_LABELS[s]}
                <span className="sr-only">{current ? " (current)" : done ? " (done)" : " (not yet)"}</span>
              </span>
              {i < path.length - 1 && <span className="h-px w-3 bg-border" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
      {stoppedAt && (
        <p className="text-sm font-medium text-destructive">This request was {STATUS_LABELS[stoppedAt].toLowerCase()}.</p>
      )}
      <ol className="relative space-y-4 border-l border-border pl-5">
        {[...r.statusHistory].reverse().map((e, i) => (
          <li key={`${e.status}-${e.at}-${i}`} className="relative">
            <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" aria-hidden="true" />
            <p className="text-sm font-medium">{STATUS_LABELS[e.status]}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(e.at).toLocaleString()} · {e.by === "requester" ? "You or the requester" : e.by === "system" ? "System" : "DE team"}
            </p>
            {e.note && <p className="mt-1 text-sm">{e.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function PortalServiceRequestDetail() {
  const [, params] = useRoute("/portal/requests/:id");
  const id = params?.id ?? "";
  const q = useQuery({ queryKey: ["/api/portal/service-requests", id], queryFn: () => srApi.get(id), enabled: Boolean(id) });
  const invalidate = useInvalidateRequests();
  const [busy, setBusy] = useState<null | "cancel" | "upload">(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const r = q.data?.request;

  const cancel = async () => {
    if (!r || !window.confirm(`Cancel ${r.number}?`)) return;
    setBusy("cancel");
    setError(null);
    try {
      await srApi.cancel(r.id);
      invalidate();
      await q.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(null);
    }
  };

  const upload = async (files: FileList) => {
    if (!r) return;
    setBusy("upload");
    setError(null);
    try {
      for (const f of Array.from(files)) await srApi.attach(r.id, f);
      await q.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const download = async (attachmentId: string, fileName: string) => {
    if (!r) return;
    const res = await portalFetch(srApi.attachmentUrl(r.id, attachmentId));
    if (!res.ok) return setError("Download failed");
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const title = r ? `${r.number} · ${TYPE_LABELS[r.type]}` : "Request";
  const address = r?.site ?? r?.customAddress;

  return (
    <PortalLayout
      title={title}
      eyebrow={r ? <RequestStatusToken status={r.status} /> : undefined}
      backHref="/portal/requests"
      backLabel="Service Requests"
      width="default"
      actions={
        r && USER_CANCELLABLE.includes(r.status) ? (
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={Boolean(busy)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent disabled:opacity-60"
          >
            {busy === "cancel" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Cancel request
          </button>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : q.isError || !r ? (
        <Callout tone="bad" title="Request not found">
          It may belong to someone else, or the link is wrong.
        </Callout>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            {error && <Callout tone="bad">{error}</Callout>}
            <Panel id="request-status" title="Status">
              <Timeline r={r} />
            </Panel>
            <Panel id="request-details" title="Details">
              <dl className="grid gap-4 sm:grid-cols-2">
                {fieldRows(r).map(([label, value]) => (
                  <Detail key={label} label={label}>
                    {value}
                  </Detail>
                ))}
              </dl>
            </Panel>
          </div>
          <div className="space-y-4">
            <ApprovalPanel r={r} />
            <ContactPanel r={r} />
            <Panel id="request-location" title="Location">
              {address ? (
                <address className="text-sm not-italic">
                  {r.site ? <p className="font-semibold">{r.site.code}</p> : <p className="text-muted-foreground">Not a company location</p>}
                  <p>{address.street}</p>
                  <p>
                    {address.city}, {address.state} {address.zip}
                  </p>
                  <p>{address.country}</p>
                </address>
              ) : (
                <p className="text-sm text-muted-foreground">No location on file.</p>
              )}
            </Panel>
            <Panel id="request-attachments" title="Attachments">
              {r.attachments.length ? (
                <ul className="space-y-1 text-sm">
                  {r.attachments.map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => void download(a.id, a.fileName)} className="text-[hsl(var(--primary))] hover:underline">
                        {a.fileName}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None.</p>
              )}
              {!TERMINAL_STATUSES.includes(r.status) && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept={PORTAL_TICKET_ACCEPT}
                    className="sr-only"
                    id="sr-detail-attachments"
                    onChange={(e) => {
                      if (e.target.files?.length) void upload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={Boolean(busy)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))] hover:underline disabled:opacity-60"
                  >
                    {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Paperclip className="h-4 w-4" aria-hidden="true" />}
                    Add attachments
                  </button>
                </>
              )}
            </Panel>
          </div>
        </div>
      )}
      <PortalHelpChat page={{ kind: "service_request_detail", title, requestNumber: r?.number }} />
    </PortalLayout>
  );
}

function ApprovalPanel({ r }: { r: ServiceRequestRecord }) {
  const qc = useQueryClient();
  const flow = r.payload.approvalFlow as ApprovalFlow | undefined;
  if (!flow || !flow.required) return null;
  const me = readPortalUser();
  const canDecide = r.status === "pending_approval" && flow.state === "pending" && (me?.role === "admin" || flow.approvers.some((a) => a.userId === me?.id));
  return (
    <Panel id="request-approval" title="Approval">
      <p className="text-sm">{approvalSummary(flow)}</p>
      {flow.state === "pending" && (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {flow.approvers.map((a) => (
            <li key={a.userId}>
              {a.name} · {APPROVER_ROLE_LABELS[a.role]}
            </li>
          ))}
        </ul>
      )}
      {canDecide && (
        <div className="mt-3 border-t border-border pt-3">
          <ApprovalDecision request={r} onDone={(u) => {
              qc.setQueryData<{ success: boolean; request: ServiceRequestRecord }>(["/api/portal/service-requests", r.id], { success: true, request: u });
            }} />
        </div>
      )}
    </Panel>
  );
}

function ContactPanel({ r }: { r: ServiceRequestRecord }) {
  const plan = r.payload.contactPlan as ContactPlan | undefined;
  if (!plan) return null;
  return (
    <Panel id="request-contact" title="Who DE contacts">
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-[0.06em] text-muted-foreground">Person</dt>
          <dd>
            {plan.primary.name} <span className="pt-num text-muted-foreground">· {plan.personId}</span>
            {plan.supportTier === "vip" && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs">VIP</span>}
          </dd>
        </div>
        {plan.fallback && (
          <div>
            <dt className="text-xs uppercase tracking-[0.06em] text-muted-foreground">If unavailable</dt>
            <dd>
              {plan.fallback.name} ({plan.fallback.role === "leader" ? "leader" : "backup leader"}
              {plan.unit?.name ? `, ${plan.unit.name}` : ""})
            </dd>
          </div>
        )}
        {plan.cc.length > 0 && (
          <div>
            <dt className="text-xs uppercase tracking-[0.06em] text-muted-foreground">Copied</dt>
            <dd>{plan.cc.map((c) => c.name).join(", ")}</dd>
          </div>
        )}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{plan.summary}</p>
    </Panel>
  );
}
