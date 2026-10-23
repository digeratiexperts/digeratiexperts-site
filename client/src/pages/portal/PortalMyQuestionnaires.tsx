import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, EmptyState, Panel, Token, type TokenTone } from "@/components/portal/ui";
import { MY_QUESTIONNAIRES_KEY, formatAnswer, questionnairesApi, type MyQuestionnaire, type Question } from "@/lib/questionnairesApi";
import { ASSIGNMENT_STATUS_LABELS, formatDueDay, type AssignmentStatus } from "@shared/questionnaires";
import { PortalLayout } from "./PortalLayout";

/**
 * My questionnaires: what DE has asked this person to fill in, with a form that
 * saves a draft and submits (server/questionnaireRoutes.ts). Only the person it
 * was assigned to sees it.
 */

const STATUS_TONE: Record<AssignmentStatus, TokenTone> = { assigned: "warn", draft: "info", submitted: "ok", reviewed: "ok" };
const OPEN = new Set<AssignmentStatus>(["assigned", "draft"]);

export function QuestionnaireStatus({ q }: { q: Pick<MyQuestionnaire, "status" | "overdue"> }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <Token label={ASSIGNMENT_STATUS_LABELS[q.status]} tone={STATUS_TONE[q.status]} dot />
      {q.overdue && <Token label="Overdue" tone="bad" />}
    </span>
  );
}

function QuestionField({ q, value, onChange, disabled }: { q: Question; value: unknown; onChange: (v: unknown) => void; disabled: boolean }) {
  const name = `q-${q.id}`;
  const label = (
    <legend className="text-sm font-medium">
      {q.label}
      {q.required && <span className="pt-link ml-0.5" aria-hidden="true">*</span>}
      {q.helpText && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{q.helpText}</span>}
    </legend>
  );
  if (q.type === "text") {
    return (
      <div className="space-y-1.5">
        <label htmlFor={name} className="block text-sm font-medium">
          {q.label}
          {q.required && <span className="pt-link ml-0.5" aria-hidden="true">*</span>}
        </label>
        {q.helpText && <p className="text-xs text-muted-foreground">{q.helpText}</p>}
        <Textarea id={name} rows={3} value={typeof value === "string" ? value : ""} disabled={disabled} maxLength={4000} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  if (q.type === "rating") {
    return (
      <fieldset className="space-y-1.5">
        {label}
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex min-h-[40px] items-center gap-2 text-sm">
              <input type="radio" name={name} checked={Number(value) === n} disabled={disabled} onChange={() => onChange(n)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              {n}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  const options = q.options ?? [];
  if (q.type === "single") {
    return (
      <fieldset className="space-y-1.5">
        {label}
        <div className="flex flex-col gap-1">
          {options.map((o) => (
            <label key={o} className="flex min-h-[36px] items-center gap-2 text-sm">
              <input type="radio" name={name} checked={value === o} disabled={disabled} onChange={() => onChange(o)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  const picked = Array.isArray(value) ? (value as string[]) : [];
  return (
    <fieldset className="space-y-1.5">
      {label}
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <label key={o} className="flex min-h-[36px] items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={picked.includes(o)}
              disabled={disabled}
              onChange={() => onChange(picked.includes(o) ? picked.filter((x) => x !== o) : [...picked, o])}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Questionnaire({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [...MY_QUESTIONNAIRES_KEY, id], queryFn: () => questionnairesApi.open(id) });
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  useEffect(() => {
    if (q.data) setAnswers(q.data.questionnaire.answers ?? {});
  }, [q.data]);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: MY_QUESTIONNAIRES_KEY });
  };
  const draft = useMutation({
    mutationFn: () => questionnairesApi.saveDraft(id, answers),
    onSuccess: () => {
      setMessage({ tone: "ok", text: "Draft saved. You can come back and finish it later." });
      refresh();
    },
    onError: (e) => setMessage({ tone: "bad", text: e instanceof Error ? e.message : "Could not save" }),
  });
  const submit = useMutation({
    mutationFn: () => questionnairesApi.submit(id, answers),
    onSuccess: () => {
      setMessage({ tone: "ok", text: "Submitted. Thank you, DE will review your answers." });
      refresh();
    },
    onError: (e) => setMessage({ tone: "bad", text: e instanceof Error ? e.message : "Could not submit" }),
  });

  if (q.isPending) return <Skeleton className="h-48 rounded-xl" />;
  if (q.isError || !q.data)
    return (
      <Callout tone="bad" title="This questionnaire couldn't be opened">
        {q.error instanceof Error ? q.error.message : ""}
      </Callout>
    );
  const data = q.data.questionnaire;
  const editable = OPEN.has(data.status);

  return (
    <Panel
      id="questionnaire-form"
      title={data.title}
      description={`Due ${formatDueDay(data.dueOn)}`}
      actions={
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Back to list
        </Button>
      }
    >
      <div className="space-y-5">
        <QuestionnaireStatus q={data} />
        {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
        {data.note && (
          <Callout tone="info" title="Note from DE">
            {data.note}
          </Callout>
        )}
        {editable ? (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            {data.questions.map((question) => (
              <QuestionField key={question.id} q={question} value={answers[question.id]} disabled={false} onChange={(v) => setAnswers((a) => ({ ...a, [question.id]: v }))} />
            ))}
            {message && <Callout tone={message.tone} title={message.text} />}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={submit.isPending} data-testid="questionnaire-submit">
                {submit.isPending ? "Submitting…" : "Submit"}
              </Button>
              <Button type="button" variant="outline" disabled={draft.isPending} onClick={() => draft.mutate()} data-testid="questionnaire-draft">
                {draft.isPending ? "Saving…" : "Save draft"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            {message && <Callout tone={message.tone} title={message.text} />}
            <dl className="space-y-3">
              {data.questions.map((question) => (
                <div key={question.id}>
                  <dt className="text-sm font-medium">{question.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{formatAnswer(data.answers[question.id])}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </Panel>
  );
}

export default function PortalMyQuestionnaires() {
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("id"));
  const list = useQuery({ queryKey: MY_QUESTIONNAIRES_KEY, queryFn: questionnairesApi.mine });
  const items = list.data?.questionnaires ?? [];

  return (
    <PortalLayout title="My questionnaires" description="Questions DE has asked you to answer, such as onboarding details or a yearly review.">
      <div className="space-y-4">
        {openId ? (
          <Questionnaire id={openId} onClose={() => setOpenId(null)} />
        ) : list.isError ? (
          <Callout tone="bad" title="Your questionnaires couldn't be loaded">
            {list.error instanceof Error ? list.error.message : ""}
          </Callout>
        ) : list.isPending ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : items.length === 0 ? (
          <Panel id="questionnaires">
            <EmptyState icon={ClipboardList} title="Nothing to fill in" description="When DE needs information from you, the questionnaire appears here and on Home." />
          </Panel>
        ) : (
          <Panel id="questionnaires" title="Your questionnaires" flush>
            <ul className="divide-y divide-border">
              {items.map((q) => (
                <li key={q.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center md:px-5" data-testid={`my-questionnaire-${q.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{q.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Due <span className="pt-num">{formatDueDay(q.dueOn)}</span> · {q.questionCount} {q.questionCount === 1 ? "question" : "questions"}
                    </p>
                    <div className="mt-2">
                      <QuestionnaireStatus q={q} />
                    </div>
                  </div>
                  <Button type="button" size="sm" variant={OPEN.has(q.status) ? "default" : "outline"} onClick={() => setOpenId(q.id)}>
                    {q.status === "assigned" ? "Start" : q.status === "draft" ? "Continue" : "View answers"}
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </PortalLayout>
  );
}
