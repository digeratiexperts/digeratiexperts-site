import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Callout, EmptyState, GenericStatus, Panel } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { portalFetch } from "@/lib/portalApi";
import { GROUP_REQUEST_KINDS, type GroupRequestKind } from "@shared/representation";

/**
 * My groups: the sites or departments the signed-in person represents for
 * Digerati Experts, as set up in the Intelligence Hub. A representative can
 * file group-level requests (equipment collection, technology needs, group
 * concerns) and follow them. Representing a group is not approval authority.
 * The server decides everything shown here (server/representationRoutes.ts).
 */

const BASE = "/api/portal/representation";

type MyGroup = {
  scopeKey: string;
  kind: string;
  name: string;
  myRole: "primary" | "backup";
  myResponsibilities: string[];
  myEffectiveUntil: string | null;
  representatives: { role: string; displayName: string }[];
  allowedKinds: GroupRequestKind[];
};
type GroupRequestRow = {
  id: string;
  number: string;
  scopeKey: string;
  groupName: string;
  kind: GroupRequestKind;
  subject: string;
  status: string;
  submittedByMe: boolean;
  hasDeskTicket: boolean;
  createdAt: string;
};

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await portalFetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

const KIND_LABEL: Record<string, string> = Object.fromEntries(GROUP_REQUEST_KINDS.map((k) => [k.key, k.label]));
const DUTY_LABEL: Record<string, string> = {
  coordinate_equipment_collection: "Coordinate equipment collection",
  coordinate_hardware_inventory: "Coordinate hardware inventory",
  relay_group_announcements: "Relay announcements to your group",
  collect_technology_needs: "Collect your group's technology needs",
  coordinate_onsite_access: "Coordinate onsite access",
  coordinate_joiners_leavers: "Coordinate joiners and leavers",
};

function RequestForm({ groups }: { groups: MyGroup[] }) {
  const queryClient = useQueryClient();
  const [scopeKey, setScopeKey] = useState(groups[0]?.scopeKey ?? "");
  const group = groups.find((g) => g.scopeKey === scopeKey) ?? groups[0];
  const kinds = GROUP_REQUEST_KINDS.filter((k) => group?.allowedKinds.includes(k.key));
  const [kind, setKind] = useState<GroupRequestKind | "">(kinds[0]?.key ?? "");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const effectiveKind = kinds.some((k) => k.key === kind) ? kind : kinds[0]?.key ?? "";
  const create = useMutation({
    mutationFn: () =>
      call<{ request: GroupRequestRow }>(`${BASE}/requests`, {
        method: "POST",
        body: JSON.stringify({ scopeKey: group.scopeKey, kind: effectiveKind, subject: subject.trim(), description: description.trim() }),
      }),
    onSuccess: () => {
      setSubject("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: [`${BASE}/requests`] });
    },
  });
  if (!group) return null;
  return (
    <Panel title="Send a request for your group" description="DE receives it as a ticket tagged with your group.">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!effectiveKind || subject.trim().length < 3 || description.trim().length < 3) return;
          create.mutate();
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Group
          <select className="min-h-[40px] rounded-md border border-border bg-background px-3" value={group.scopeKey} onChange={(e) => setScopeKey(e.target.value)}>
            {groups.map((g) => (
              <option key={g.scopeKey} value={g.scopeKey}>{g.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Kind of request
          <select
            className="min-h-[40px] rounded-md border border-border bg-background px-3"
            value={effectiveKind}
            onChange={(e) => setKind(e.target.value as GroupRequestKind)}
            disabled={kinds.length === 0}
          >
            {kinds.map((k) => (
              <option key={k.key} value={k.key}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Subject
          <input className="min-h-[40px] rounded-md border border-border bg-background px-3" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} required minLength={3} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Details
          <textarea className="min-h-[110px] rounded-md border border-border bg-background px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} required minLength={3} />
        </label>
        {kinds.length === 0 && (
          <p className="text-sm text-muted-foreground sm:col-span-2">Your role for this group doesn't include sending requests. Contact DE if that should change.</p>
        )}
        {create.isError && (
          <div className="sm:col-span-2">
            <Callout tone="bad" title="Not sent">{(create.error as Error).message}</Callout>
          </div>
        )}
        {create.isSuccess && (
          <p role="status" className="text-sm sm:col-span-2">Sent as {create.data.request.number}. It appears below.</p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={create.isPending || kinds.length === 0}
            className="inline-flex min-h-[40px] items-center rounded-md bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))] disabled:opacity-50"
          >
            {create.isPending ? "Sending…" : "Send request"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

export default function PortalRepresentation() {
  const me = useQuery({ queryKey: [`${BASE}/me`], queryFn: () => call<{ linked: boolean; available: boolean; groups: MyGroup[] }>(`${BASE}/me`) });
  const requests = useQuery({
    queryKey: [`${BASE}/requests`],
    queryFn: () => call<{ requests: GroupRequestRow[] }>(`${BASE}/requests`),
    enabled: (me.data?.groups.length ?? 0) > 0,
  });
  const groups = me.data?.groups ?? [];

  return (
    <PortalLayout title="My groups" description="The parts of your organization you represent for Digerati Experts." width="wide">
      <div className="space-y-8">
        {me.isLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : me.isError ? (
          <Callout tone="bad" title="Your groups couldn't be loaded">{(me.error as Error).message}</Callout>
        ) : !me.data?.available ? (
          <Callout tone="warn" title="Representation details are unavailable right now">
            Digerati Experts' records couldn't be reached. Try again in a few minutes.
          </Callout>
        ) : groups.length === 0 ? (
          <Panel flush>
            <EmptyState
              icon={Users}
              title="You don't represent a group"
              description="If your company asked you to represent a site or department, Digerati Experts will set that up and it will appear here."
            />
          </Panel>
        ) : (
          <>
            <section aria-labelledby="groups-heading">
              <h2 id="groups-heading" className="mb-3 text-base font-semibold">Groups you represent</h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {groups.map((g) => (
                  <li key={g.scopeKey} className="rounded-xl border border-border bg-card p-4 shadow-sm" data-testid={`rep-group-${g.scopeKey}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{g.name}</span>
                      <span className="text-xs uppercase tracking-[0.06em] text-muted-foreground">{g.kind.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-1 text-sm">You are the {g.myRole} representative{g.myEffectiveUntil ? ` until ${g.myEffectiveUntil}` : ""}.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      With you: {g.representatives.filter((r) => r.displayName).map((r) => `${r.displayName} (${r.role})`).join(", ")}
                    </p>
                    {g.myResponsibilities.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                        {g.myResponsibilities.map((d) => (
                          <li key={d}>{DUTY_LABEL[d] ?? d}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted-foreground">
                Representing a group means you coordinate with DE for it. Approvals for purchases, contracts, security or account changes still follow your company's approval rules.
              </p>
            </section>
            <RequestForm groups={groups} />
            <section aria-labelledby="group-requests-heading">
              <h2 id="group-requests-heading" className="mb-3 text-base font-semibold">Requests for your groups</h2>
              {requests.isLoading ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : requests.isError ? (
                <Callout tone="bad" title="Requests couldn't be loaded">{(requests.error as Error).message}</Callout>
              ) : (requests.data?.requests.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No group requests yet.</p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  {requests.data!.requests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                      <span className="pt-num font-semibold">{r.number}</span>
                      <span>{r.subject}</span>
                      <span className="text-muted-foreground">
                        {r.groupName} · {KIND_LABEL[r.kind] ?? r.kind} · {new Date(r.createdAt).toLocaleDateString()}
                        {r.submittedByMe ? " · by you" : ""}
                      </span>
                      <span className="ml-auto">
                        <GenericStatus status={r.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
