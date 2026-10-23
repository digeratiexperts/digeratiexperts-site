import { useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, EmptyState, Field, Panel, Token, type TokenTone } from "@/components/portal/ui";
import { portalGet } from "@/lib/portalApi";
import { ADMIN_NOTICES_QUERY_KEY, STATUS_QUERY_KEY, StatusApiError, statusApi, type AdminNotice } from "@/lib/statusApi";
import {
  KIND_LABELS,
  NOTICE_KINDS,
  NOTICE_SEVERITIES,
  SEVERITY_LABELS,
  placeNotice,
  type NoticeInput,
  type NoticeKind,
  type NoticeSeverity,
} from "@shared/statusNotices";
import { PortalLayout } from "./PortalLayout";

/**
 * DE admin: post and manage System Status notices for one client company or
 * for every client. Clients read them on /portal/status and on Home.
 */

type Tenant = { id: string; companyName: string; type: "msp" | "client" };

const severityTone: Record<NoticeSeverity, TokenTone> = { info: "info", degraded: "warn", outage: "bad" };
const PLACE_LABEL = { active: "Open", inProgress: "In progress", upcoming: "Scheduled", history: "Resolved" } as const;
const PLACE_TONE: Record<keyof typeof PLACE_LABEL, TokenTone> = { active: "warn", inProgress: "info", upcoming: "neutral", history: "ok" };

/** <input type="datetime-local"> works in local time without a zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Draft = {
  clientId: string; // "" = every client
  kind: NoticeKind;
  severity: NoticeSeverity;
  title: string;
  body: string;
  services: string;
  startsAt: string;
  endsAt: string;
};

const blankDraft = (): Draft => ({
  clientId: "",
  kind: "incident",
  severity: "degraded",
  title: "",
  body: "",
  services: "",
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: "",
});

const draftFrom = (n: AdminNotice): Draft => ({
  clientId: n.clientId ?? "",
  kind: n.kind,
  severity: n.severity,
  title: n.title,
  body: n.body,
  services: n.affectedServices.join(", "),
  startsAt: toLocalInput(n.startsAt),
  endsAt: toLocalInput(n.endsAt),
});

const toInput = (d: Draft): NoticeInput => ({
  clientId: d.clientId || null,
  kind: d.kind,
  severity: d.severity,
  title: d.title,
  body: d.body,
  affectedServices: d.services.split(",").map((s) => s.trim()).filter(Boolean),
  startsAt: fromLocalInput(d.startsAt) ?? "",
  endsAt: fromLocalInput(d.endsAt),
});

const selectClass = "h-10 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground";

function NoticeForm({ editing, clients, onDone }: { editing: AdminNotice | null; clients: Tenant[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => (editing ? draftFrom(editing) : blankDraft()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = useMutation({
    mutationFn: () => (editing ? statusApi.edit(editing.id, toInput(draft)) : statusApi.create(toInput(draft))),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ADMIN_NOTICES_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
      setDraft(blankDraft());
      setErrors({});
      setFormError(null);
      onDone();
    },
    onError: (e) => {
      setErrors(e instanceof StatusApiError ? e.fieldErrors : {});
      setFormError(e instanceof Error ? e.message : "Could not save");
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Panel id="notice-form" title={editing ? "Edit notice" : "Post a notice"} description="Clients see it on System Status and on Home.">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
        <Field label="Who sees it" htmlFor="notice-client" error={errors.clientId}>
          <select id="notice-client" className={selectClass} value={draft.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="notice-kind" error={errors.kind}>
            <select id="notice-kind" className={selectClass} value={draft.kind} onChange={(e) => set("kind", e.target.value as NoticeKind)}>
              {NOTICE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Impact" htmlFor="notice-severity" error={errors.severity}>
            <select id="notice-severity" className={selectClass} value={draft.severity} onChange={(e) => set("severity", e.target.value as NoticeSeverity)}>
              {NOTICE_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Title" htmlFor="notice-title" required error={errors.title} className="md:col-span-2">
          <Input id="notice-title" value={draft.title} maxLength={160} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Details" htmlFor="notice-body" error={errors.body} hint="What's affected and what clients should do." className="md:col-span-2">
          <Textarea id="notice-body" rows={3} value={draft.body} maxLength={4000} onChange={(e) => set("body", e.target.value)} />
        </Field>
        <Field label="Affected services" htmlFor="notice-services" error={errors.affectedServices} hint="Comma-separated, e.g. Email, VPN" className="md:col-span-2">
          <Input id="notice-services" value={draft.services} onChange={(e) => set("services", e.target.value)} />
        </Field>
        <Field label="Starts" htmlFor="notice-starts" required error={errors.startsAt}>
          <Input id="notice-starts" type="datetime-local" value={draft.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </Field>
        <Field
          label={draft.kind === "maintenance" ? "Planned end" : "Expected recovery"}
          htmlFor="notice-ends"
          required={draft.kind === "maintenance"}
          error={errors.endsAt}
          hint={draft.kind === "maintenance" ? undefined : "Optional"}
        >
          <Input id="notice-ends" type="datetime-local" value={draft.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
        </Field>
        {formError && (
          <Callout tone="bad" title={formError} className="md:col-span-2" />
        )}
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" disabled={save.isPending} data-testid="notice-save">
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Post notice"}
          </Button>
          {editing && (
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}

function NoticeRow({ notice, onEdit }: { notice: AdminNotice; onEdit: () => void }) {
  const qc = useQueryClient();
  const [update, setUpdate] = useState("");
  const [resolve, setResolve] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const place = placeNotice(notice, new Date()) ?? "history";
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ADMIN_NOTICES_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
  };
  const onError = (e: unknown) => setError(e instanceof Error ? e.message : "Could not save");

  const post = useMutation({
    mutationFn: () => statusApi.postUpdate(notice.id, update, resolve),
    onSuccess: () => {
      setUpdate("");
      setResolve(false);
      setError(null);
      refresh();
    },
    onError,
  });
  const reopen = useMutation({ mutationFn: () => statusApi.edit(notice.id, { reopen: true }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: () => statusApi.remove(notice.id), onSuccess: refresh, onError });

  return (
    <li className="space-y-3 px-4 py-4 md:px-5" data-testid={`admin-notice-${notice.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{notice.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {notice.companyName ?? "All clients"} · {KIND_LABELS[notice.kind]} · <span className="pt-num">{when(notice.startsAt)}</span>
            {notice.endsAt && <> to <span className="pt-num">{when(notice.endsAt)}</span></>} · posted by {notice.createdByName || "DE"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Token label={SEVERITY_LABELS[notice.severity]} tone={severityTone[notice.severity]} />
          <Token label={PLACE_LABEL[place]} tone={PLACE_TONE[place]} dot />
        </div>
      </div>
      {notice.updates.length > 0 && (
        <ol className="space-y-1 border-l border-border pl-3 text-sm">
          {notice.updates.map((u) => (
            <li key={u.at}>
              <span className="text-xs text-muted-foreground">
                <span className="pt-num">{when(u.at)}</span> · {u.byName}:
              </span>{" "}
              {u.body}
            </li>
          ))}
        </ol>
      )}
      {!notice.resolvedAt && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (update.trim()) post.mutate();
          }}
        >
          <label htmlFor={`update-${notice.id}`} className="sr-only">
            Post an update
          </label>
          <Textarea id={`update-${notice.id}`} rows={2} placeholder="Post an update clients will see" value={update} onChange={(e) => setUpdate(e.target.value)} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={resolve} onChange={(e) => setResolve(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Mark resolved
            </label>
            <Button type="submit" size="sm" disabled={!update.trim() || post.isPending}>
              {post.isPending ? "Posting…" : "Post update"}
            </Button>
          </div>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
        {notice.resolvedAt && (
          <Button type="button" size="sm" variant="outline" onClick={() => reopen.mutate()} disabled={reopen.isPending}>
            Reopen
          </Button>
        )}
        {confirmDelete ? (
          <>
            <Button type="button" size="sm" variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Delete for good
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>
      {error && (
        <p className="pt-ink pt-tone-bad text-xs" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export default function AdminStatusNotices() {
  const [editing, setEditing] = useState<AdminNotice | null>(null);
  const notices = useQuery({ queryKey: ADMIN_NOTICES_QUERY_KEY, queryFn: statusApi.adminList });
  const tenants = useQuery<{ tenants: Tenant[] }>({
    queryKey: ["/api/portal/admin/tenants"],
    queryFn: () => portalGet<{ tenants: Tenant[] }>("/api/portal/admin/tenants"),
    staleTime: 60_000,
  });
  const clients = useMemo(() => (tenants.data?.tenants ?? []).filter((t) => t.type === "client"), [tenants.data]);
  const list = notices.data?.notices ?? [];

  return (
    <PortalLayout
      title="Status notices"
      description="Incidents, maintenance and notices clients see on System Status."
      actions={
        <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
          <Link href="/portal/status">View client page</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <NoticeForm key={editing?.id ?? "new"} editing={editing} clients={clients} onDone={() => setEditing(null)} />
        <Panel id="notice-list" title="Notices" description="Newest first" flush>
          {notices.isError ? (
            <div className="p-4">
              <Callout tone="bad" title="Notices couldn't be loaded">
                {notices.error instanceof Error ? notices.error.message : ""}
              </Callout>
            </div>
          ) : notices.isPending ? (
            <div className="p-4">
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : list.length === 0 ? (
            <EmptyState icon={Megaphone} title="No notices yet" description="Post one above when something affects a client's services." compact />
          ) : (
            <ul className="divide-y divide-border">
              {list.map((n) => (
                <NoticeRow
                  key={n.id}
                  notice={n}
                  onEdit={() => {
                    setEditing(n);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PortalLayout>
  );
}
