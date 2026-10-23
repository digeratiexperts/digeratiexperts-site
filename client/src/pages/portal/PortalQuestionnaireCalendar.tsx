import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, EmptyState, Field, Panel } from "@/components/portal/ui";
import { portalGet } from "@/lib/portalApi";
import { ADMIN_QUESTIONNAIRES_KEY, QuestionnaireApiError, formatAnswer, questionnairesApi, type AdminAssignment } from "@/lib/questionnairesApi";
import { ASSIGNMENT_STATUSES, ASSIGNMENT_STATUS_LABELS, formatDueDay, type AssignmentStatus } from "@shared/questionnaires";
import { QuestionnaireStatus } from "./PortalMyQuestionnaires";
import { PortalLayout } from "./PortalLayout";

/**
 * DE Questionnaires: assign a portal survey to a person at a client company,
 * see every assignment by due month, read the answers, mark them reviewed or
 * send them back (server/questionnaireRoutes.ts).
 */

type Tenant = { id: string; companyName: string; type: "msp" | "client" };
const selectClass = "h-10 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground";
const monthKey = (d: Date) => format(d, "yyyy-MM");

function AssignForm() {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [surveyId, setSurveyId] = useState("");
  const [userId, setUserId] = useState("");
  const [dueOn, setDueOn] = useState(() => format(new Date(Date.now() + 14 * 86400000), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const tenants = useQuery<{ tenants: Tenant[] }>({ queryKey: ["/api/portal/admin/tenants"], queryFn: () => portalGet("/api/portal/admin/tenants"), staleTime: 60_000 });
  const clients = (tenants.data?.tenants ?? []).filter((t) => t.type === "client");
  const options = useQuery({ queryKey: [...ADMIN_QUESTIONNAIRES_KEY, "options"], queryFn: questionnairesApi.options });
  const people = useQuery({ queryKey: [...ADMIN_QUESTIONNAIRES_KEY, "people", clientId], queryFn: () => questionnairesApi.people(clientId), enabled: Boolean(clientId) });
  const assign = useMutation({
    mutationFn: () => questionnairesApi.assign({ clientId, surveyId, assignedToUserId: userId, dueOn, note }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ADMIN_QUESTIONNAIRES_KEY });
      setErrors({});
      setNote("");
      setUserId("");
      setMsg({ tone: "ok", text: `Assigned to ${r.assignment.assignedToName}. They see it on Home and in My questionnaires.` });
    },
    onError: (e) => {
      setErrors(e instanceof QuestionnaireApiError ? e.fieldErrors : {});
      setMsg({ tone: "bad", text: e instanceof Error ? e.message : "Could not assign" });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    assign.mutate();
  };
  return (
    <Panel id="assign-form" title="Assign a questionnaire" description="The person fills it in from their portal; you review the answers here.">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
        <Field label="Company" htmlFor="qa-company" required error={errors.clientId}>
          <select id="qa-company" className={selectClass} value={clientId} onChange={(e) => { setClientId(e.target.value); setUserId(""); }}>
            <option value="">{tenants.isPending ? "Loading…" : "Choose a company…"}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>
        </Field>
        <Field label="Person" htmlFor="qa-person" required error={errors.assignedToUserId}>
          <select id="qa-person" className={selectClass} value={userId} disabled={!clientId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">{!clientId ? "Choose a company first" : people.isPending ? "Loading…" : (people.data?.people ?? []).length === 0 ? "No active people at this company" : "Choose a person…"}</option>
            {(people.data?.people ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.email ? ` (${p.email})` : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="Questionnaire" htmlFor="qa-survey" required error={errors.surveyId}>
          <select id="qa-survey" className={selectClass} value={surveyId} onChange={(e) => setSurveyId(e.target.value)}>
            <option value="">{options.isPending ? "Loading…" : "Choose a questionnaire…"}</option>
            {(options.data?.surveys ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.title} ({s.questionCount} questions)</option>
            ))}
          </select>
        </Field>
        <Field label="Due" htmlFor="qa-due" required error={errors.dueOn}>
          <Input id="qa-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </Field>
        <Field label="Note to the person" htmlFor="qa-note" error={errors.note} className="md:col-span-2">
          <Textarea id="qa-note" rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {msg && <Callout tone={msg.tone} title={msg.text} className="md:col-span-2" />}
        <div className="md:col-span-2">
          <Button type="submit" disabled={assign.isPending} data-testid="questionnaire-assign">
            {assign.isPending ? "Assigning…" : "Assign"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...ADMIN_QUESTIONNAIRES_KEY, id], queryFn: () => questionnairesApi.adminGet(id) });
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    void qc.invalidateQueries({ queryKey: ADMIN_QUESTIONNAIRES_KEY });
    setError(null);
  };
  const onError = (e: unknown) => setError(e instanceof Error ? e.message : "Could not save");
  const edit = useMutation({ mutationFn: (patch: Parameters<typeof questionnairesApi.edit>[1]) => questionnairesApi.edit(id, patch), onSuccess: done, onError });
  const remove = useMutation({ mutationFn: () => questionnairesApi.remove(id), onSuccess: () => { done(); onClose(); }, onError });
  if (q.isPending) return <Skeleton className="h-40 rounded-xl" />;
  if (!q.data) return <Callout tone="bad" title="This assignment couldn't be loaded" />;
  const a = q.data.assignment;
  const submitted = a.status === "submitted" || a.status === "reviewed";
  return (
    <Panel
      id="assignment-detail"
      title={`${a.title} · ${a.assignedToName}`}
      description={`${a.companyName} · due ${formatDueDay(a.dueOn)} · assigned by ${a.assignedByName || "DE"}`}
      actions={<Button type="button" size="sm" variant="outline" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        <QuestionnaireStatus q={a} />
        {submitted ? (
          <dl className="space-y-3">
            {a.questions.map((question) => (
              <div key={question.id}>
                <dt className="text-sm font-medium">{question.label}</dt>
                <dd className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{formatAnswer(a.answers[question.id])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Answers appear here once {a.assignedToName} submits.</p>
        )}
        {a.status === "submitted" && (
          <div className="space-y-2 rounded-lg border border-border bg-background p-3">
            <label htmlFor="qa-back-note" className="text-sm font-medium">Send back with a note (optional)</label>
            <Textarea id="qa-back-note" rows={2} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={edit.isPending} onClick={() => edit.mutate({ status: "reviewed" })} data-testid="questionnaire-reviewed">Mark reviewed</Button>
              <Button type="button" size="sm" variant="outline" disabled={edit.isPending} onClick={() => edit.mutate({ status: "draft", ...(note.trim() ? { note } : {}) })}>Send back</Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {confirm ? (
            <>
              <Button type="button" size="sm" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>Delete for good</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setConfirm(false)}>Keep</Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => setConfirm(true)}>Delete assignment</Button>
          )}
        </div>
        {error && <p className="pt-ink pt-tone-bad text-xs" role="alert">{error}</p>}
      </div>
    </Panel>
  );
}

export function PortalQuestionnaireCalendar() {
  const [month, setMonth] = useState(() => new Date());
  const [status, setStatus] = useState<"all" | "open" | AssignmentStatus>("open");
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({ queryKey: ADMIN_QUESTIONNAIRES_KEY, queryFn: questionnairesApi.adminList });
  const all = list.data?.assignments ?? [];
  const overdue = all.filter((a) => a.overdue);
  const toReview = all.filter((a) => a.status === "submitted");
  const shown = useMemo(() => {
    const key = monthKey(month);
    return all.filter(
      (a) =>
        a.dueOn.startsWith(key) &&
        (status === "all" || (status === "open" ? a.status === "assigned" || a.status === "draft" : a.status === status)),
    );
  }, [all, month, status]);
  const byDay = useMemo(() => {
    const groups = new Map<string, AdminAssignment[]>();
    for (const a of shown) groups.set(a.dueOn, [...(groups.get(a.dueOn) ?? []), a]);
    return [...groups.entries()];
  }, [shown]);

  return (
    <PortalLayout title="DE Questionnaires" description="Assign questionnaires to client contacts, track due dates and review the answers.">
      <div className="space-y-4">
        <AssignForm />
        {selected && <Detail id={selected} onClose={() => setSelected(null)} />}
        {toReview.length > 0 && (
          <Panel id="to-review" title="Waiting for your review" description="Submitted, any due month" flush>
            <ul className="divide-y divide-border">
              {toReview.map((a) => (
                <li key={a.id} className="px-4 py-2 md:px-5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(a.id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex w-full flex-wrap items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid={`review-${a.id}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{a.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {a.assignedToName} · {a.companyName} · due {formatDueDay(a.dueOn)}
                      </span>
                    </span>
                    <QuestionnaireStatus q={a} />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {overdue.length > 0 && (
          <Callout tone="warn" title={`${overdue.length} overdue`}>
            {overdue.slice(0, 5).map((a) => `${a.assignedToName} (${a.companyName}): ${a.title}`).join(" · ")}
            {overdue.length > 5 ? " · …" : ""}
          </Callout>
        )}
        <Panel
          id="questionnaire-calendar"
          title={format(month, "MMMM yyyy")}
          description="By due date"
          actions={
            <div className="flex flex-wrap gap-1.5">
              <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))}>←</Button>
              <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => setMonth(new Date())}>Today</Button>
              <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))}>→</Button>
            </div>
          }
          flush
        >
          <div className="border-b border-border px-4 py-3 md:px-5">
            <label htmlFor="qa-filter" className="sr-only">Filter by status</label>
            <select id="qa-filter" className="h-9 rounded-md border border-border bg-card px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="open">Not submitted yet</option>
              <option value="all">All</option>
              {ASSIGNMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{ASSIGNMENT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          {list.isError ? (
            <div className="p-4"><Callout tone="bad" title="Assignments couldn't be loaded">{list.error instanceof Error ? list.error.message : ""}</Callout></div>
          ) : list.isPending ? (
            <div className="p-4"><Skeleton className="h-24 rounded-xl" /></div>
          ) : byDay.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing due this month" description="Assign a questionnaire above, or look at another month." compact />
          ) : (
            <ul className="divide-y divide-border">
              {byDay.map(([day, items]) => (
                <li key={day} className="px-4 py-3 md:px-5">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{formatDueDay(day)}</p>
                  <ul className="mt-2 space-y-2">
                    {items.map((a) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => { setSelected(a.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex w-full flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`assignment-${a.id}`}>
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{a.title}</span>
                            <span className="block text-xs text-muted-foreground">{a.assignedToName} · {a.companyName}</span>
                          </span>
                          <QuestionnaireStatus q={a} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PortalLayout>
  );
}

export default PortalQuestionnaireCalendar;
