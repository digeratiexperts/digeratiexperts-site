import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Star, ClipboardList, ArrowLeft, Loader2 } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { portalGet, portalPost } from "@/lib/portalApi";
import { cn } from "@/lib/utils";
import { Callout, EmptyState, Field, Panel, StatTile, Token } from "@/components/portal/ui";

type SurveyQuestionType = "rating" | "text" | "single" | "multi";

interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  label: string;
  required: boolean;
  options?: string[];
  helpText?: string;
}

interface SurveyListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  status: "pending" | "completed";
  completedAt: string | null;
  questionCount: number;
}

interface SurveyDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  questions: SurveyQuestion[];
}

interface SurveysListResponse {
  success: boolean;
  surveys: SurveyListItem[];
  pendingCount: number;
  completedCount: number;
  durable?: boolean;
}

interface SurveyDetailResponse {
  success: boolean;
  survey: SurveyDetail;
  status: "pending" | "completed";
  response: {
    id: string;
    answers: Record<string, unknown>;
    rating: number | null;
    submittedAt: string;
  } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  csat: "CSAT",
  onboarding: "Onboarding",
  security: "Security",
  qbr: "Service Review",
  general: "General",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

const optionClass = (checked: boolean, readOnly: boolean) =>
  cn(
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
    checked ? "border-primary bg-accent/60" : "border-border bg-card hover:bg-accent/40",
    readOnly && "cursor-default opacity-80",
  );

export function PortalSatisfactionSurvey() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [hoveredStar, setHoveredStar] = useState<Record<string, number>>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void portalGet<{ user?: unknown }>("/api/portal/me")
      .then(() => {
        if (!cancelled) setAuthed(true);
      })
      .catch(() => {
        if (!cancelled) setAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const listQuery = useQuery<SurveysListResponse>({
    queryKey: ["/api/portal/surveys"],
    queryFn: () => portalGet<SurveysListResponse>("/api/portal/surveys"),
    enabled: authed,
    retry: 1,
  });

  const detailQuery = useQuery<SurveyDetailResponse>({
    queryKey: ["/api/portal/surveys", selectedId],
    queryFn: () =>
      portalGet<SurveyDetailResponse>(`/api/portal/surveys/${selectedId}`),
    enabled: authed && !!selectedId,
    retry: 1,
  });

  const submitMutation = useMutation({
    mutationFn: (payload: { surveyId: string; answers: Record<string, unknown> }) =>
      portalPost<{ success: boolean }>(
        `/api/portal/surveys/${payload.surveyId}/responses`,
        { answers: payload.answers }
      ),
    onSuccess: async () => {
      setSubmitSuccess(true);
      await queryClient.invalidateQueries({ queryKey: ["/api/portal/surveys"] });
      if (selectedId) {
        await queryClient.invalidateQueries({
          queryKey: ["/api/portal/surveys", selectedId],
        });
      }
      setTimeout(() => {
        setSubmitSuccess(false);
        setSelectedId(null);
        setAnswers({});
      }, 2200);
    },
  });

  const survey = detailQuery.data?.survey;
  const alreadyCompleted = detailQuery.data?.status === "completed";

  useEffect(() => {
    if (detailQuery.data?.response?.answers) {
      setAnswers(detailQuery.data.response.answers);
    } else if (detailQuery.data?.status === "pending") {
      setAnswers({});
    }
  }, [detailQuery.data]);

  const pendingSurveys = useMemo(
    () => (listQuery.data?.surveys || []).filter((s) => s.status === "pending"),
    [listQuery.data]
  );
  const completedSurveys = useMemo(
    () => (listQuery.data?.surveys || []).filter((s) => s.status === "completed"),
    [listQuery.data]
  );

  const setAnswer = (questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const toggleMulti = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId])
        ? ([...(prev[questionId] as string[])] as string[])
        : [];
      const idx = current.indexOf(option);
      if (idx >= 0) current.splice(idx, 1);
      else current.push(option);
      return { ...prev, [questionId]: current };
    });
  };

  const canSubmit = useMemo(() => {
    if (!survey || alreadyCompleted) return false;
    return survey.questions.every((q) => {
      if (!q.required) return true;
      const value = answers[q.id];
      if (value === undefined || value === null || value === "") return false;
      if (q.type === "multi") {
        return Array.isArray(value) && value.length > 0;
      }
      return true;
    });
  }, [survey, answers, alreadyCompleted]);

  const handleSubmit = () => {
    if (!selectedId || !canSubmit) return;
    submitMutation.mutate({ surveyId: selectedId, answers });
  };

  const openSurvey = (id: string) => {
    setSubmitSuccess(false);
    setSelectedId(id);
  };

  const renderList = () => {
    if (!authed) {
      return (
        <Callout
          tone="warn"
          title="Sign in required"
          action={
            <Button
              variant="brand"
              size="sm"
              onClick={() => {
                window.location.href = "/portal/login";
              }}
              data-testid="button-surveys-login"
            >
              Go to Login
            </Button>
          }
        >
          Sign in to the Client Portal to view and complete assigned surveys.
        </Callout>
      );
    }

    if (listQuery.isLoading) {
      return (
        <div className="space-y-3" data-testid="surveys-loading" aria-busy="true" aria-live="polite">
          <p className="text-sm text-muted-foreground">Loading surveys…</p>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }

    if (listQuery.isError) {
      return (
        <Callout
          tone="bad"
          title="Couldn’t load surveys"
          action={
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-card hover:bg-accent"
              onClick={() => listQuery.refetch()}
              data-testid="button-surveys-retry"
            >
              Retry
            </Button>
          }
        >
          {listQuery.error instanceof Error ? listQuery.error.message : "Unknown error"}
        </Callout>
      );
    }

    return (
      <div className="space-y-4">
        <section className="grid grid-cols-2 gap-3" aria-label="Survey figures">
          <StatTile
            label="Pending"
            value={listQuery.data?.pendingCount ?? 0}
            hint={(listQuery.data?.pendingCount ?? 0) > 0 ? "waiting on you" : "nothing waiting"}
            tone={(listQuery.data?.pendingCount ?? 0) > 0 ? "warn" : "neutral"}
            testId="badge-pending-count"
          />
          <StatTile
            label="Completed"
            value={listQuery.data?.completedCount ?? 0}
            hint="submitted"
            tone="ok"
            testId="badge-completed-count"
          />
        </section>

        <Panel id="pending-surveys" title="Available" description={`${pendingSurveys.length} waiting`} flush>
          {pendingSurveys.length === 0 ? (
            <div data-testid="surveys-empty-pending">
              <EmptyState
                icon={CheckCircle}
                title="You’re all caught up"
                description="No surveys are waiting right now. New CSAT or awareness checks will appear here when assigned."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {pendingSurveys.map((item) => (
                <li
                  key={item.id}
                  className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-accent/60 md:px-5"
                  onClick={() => openSurvey(item.id)}
                  data-testid={`survey-card-${item.slug}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <ClipboardList className="pt-link mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.title}</p>
                        <Token label={CATEGORY_LABELS[item.category] || item.category} />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      <p className="pt-num mt-1 text-xs text-muted-foreground">
                        {item.questionCount} question
                        {item.questionCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 border-border bg-card hover:bg-accent"
                    data-testid={`button-start-${item.slug}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openSurvey(item.id);
                    }}
                  >
                    Start
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {completedSurveys.length > 0 && (
          <Panel id="completed-surveys" title="Completed" description={`${completedSurveys.length} submitted`} flush>
            <ul className="divide-y divide-border">
              {completedSurveys.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 md:px-5"
                  data-testid={`survey-completed-${item.slug}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <Token label="Completed" tone="ok" dot />
                    </div>
                    <p className="pt-num mt-1 text-xs text-muted-foreground">
                      Submitted {formatDate(item.completedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedId(item.id)}
                    data-testid={`button-view-${item.slug}`}
                  >
                    View
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    );
  };

  const renderQuestion = (q: SurveyQuestion) => {
    const value = answers[q.id];
    const readOnly = alreadyCompleted;

    if (q.type === "rating") {
      const rating = Number(value || 0);
      const hover = hoveredStar[q.id] || 0;
      return (
        <div key={q.id} data-testid={`question-${q.id}`}>
          <Field label={q.label} labelId={`q-${q.id}-label`} required={q.required} hint={q.helpText}>
            <div className="flex gap-1" role="group" aria-labelledby={`q-${q.id}-label`}>
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= (hover || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    disabled={readOnly}
                    aria-label={`${star} star${star === 1 ? "" : "s"}`}
                    aria-pressed={star <= rating}
                    onClick={() => setAnswer(q.id, star)}
                    onMouseEnter={() =>
                      !readOnly && setHoveredStar((h) => ({ ...h, [q.id]: star }))
                    }
                    onMouseLeave={() =>
                      setHoveredStar((h) => ({ ...h, [q.id]: 0 }))
                    }
                    className="grid h-11 w-11 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
                    data-testid={`button-star-${q.id}-${star}`}
                  >
                    <Star
                      size={32}
                      className={cn("transition-colors", filled ? "pt-ink pt-tone-warn fill-current" : "text-muted-foreground")}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      );
    }

    if (q.type === "text") {
      return (
        <div key={q.id} data-testid={`question-${q.id}`}>
          <Field label={q.label} htmlFor={`q-${q.id}`} required={q.required} hint={q.helpText}>
            <Textarea
              id={`q-${q.id}`}
              value={String(value || "")}
              disabled={readOnly}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              className="min-h-24 border-border bg-background"
              data-testid={`textarea-${q.id}`}
            />
          </Field>
        </div>
      );
    }

    if (q.type === "single") {
      return (
        <div key={q.id} data-testid={`question-${q.id}`}>
          <Field label={q.label} labelId={`q-${q.id}-label`} required={q.required} hint={q.helpText}>
            <div className="space-y-2" role="radiogroup" aria-labelledby={`q-${q.id}-label`}>
              {(q.options || []).map((option) => {
                const selected = String(value || "") === option;
                return (
                  <label key={option} className={optionClass(selected, readOnly)}>
                    <input
                      type="radio"
                      name={q.id}
                      value={option}
                      checked={selected}
                      disabled={readOnly}
                      onChange={() => setAnswer(q.id, option)}
                      className="accent-primary"
                      data-testid={`radio-${q.id}-${option.slice(0, 24)}`}
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                );
              })}
            </div>
          </Field>
        </div>
      );
    }

    // multi
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div key={q.id} data-testid={`question-${q.id}`}>
        <Field label={q.label} labelId={`q-${q.id}-label`} required={q.required} hint={q.helpText}>
          <div className="space-y-2" role="group" aria-labelledby={`q-${q.id}-label`}>
            {(q.options || []).map((option) => {
              const checked = selected.includes(option);
              return (
                <label key={option} className={optionClass(checked, readOnly)}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => toggleMulti(q.id, option)}
                    className="accent-primary"
                    data-testid={`check-${q.id}-${option.slice(0, 24)}`}
                  />
                  <span className="text-sm">{option}</span>
                </label>
              );
            })}
          </div>
        </Field>
      </div>
    );
  };

  const renderDetail = () => {
    if (submitSuccess) {
      return (
        <Callout tone="ok" title="Thank you — your responses were saved." />
      );
    }

    if (detailQuery.isLoading) {
      return (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          <p className="text-sm text-muted-foreground">Loading survey…</p>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      );
    }

    if (detailQuery.isError || !survey) {
      return (
        <Callout
          tone="bad"
          title="Survey couldn’t be opened"
          action={
            <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => setSelectedId(null)}>
              Back to surveys
            </Button>
          }
        >
          {detailQuery.error instanceof Error ? detailQuery.error.message : "Survey not found"}
        </Callout>
      );
    }

    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          className="border-border bg-card hover:bg-accent"
          onClick={() => {
            setSelectedId(null);
            setAnswers({});
            submitMutation.reset();
          }}
          data-testid="button-back-to-surveys"
        >
          <ArrowLeft aria-hidden="true" />
          Back to surveys
        </Button>

        <Panel
          id="survey-form"
          title={survey.title}
          description={survey.description}
          actions={
            <>
              <Token label={CATEGORY_LABELS[survey.category] || survey.category} />
              {alreadyCompleted && <Token label="Completed" tone="ok" dot />}
            </>
          }
        >
          <div className="space-y-6">
            {survey.questions.map(renderQuestion)}

            {submitMutation.isError && (
              <Callout tone="bad" title="Submit failed">
                {submitMutation.error instanceof Error ? submitMutation.error.message : "Submit failed"}
              </Callout>
            )}

            {!alreadyCompleted && (
              <div className="flex gap-2">
                <Button
                  variant="brand"
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit-survey"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" aria-hidden="true" />
                      Submitting…
                    </>
                  ) : (
                    "Submit Survey"
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="border-border bg-card hover:bg-accent"
                  onClick={() => setSelectedId(null)}
                  data-testid="button-cancel-survey"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </Panel>
      </div>
    );
  };

  return (
    <PortalLayout
      title="Surveys"
      description="Complete CSAT, onboarding, and security awareness surveys assigned to your account."
    >
      {selectedId ? renderDetail() : renderList()}
    </PortalLayout>
  );
}
