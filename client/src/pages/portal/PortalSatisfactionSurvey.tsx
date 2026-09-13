import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  Star,
  ClipboardList,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { portalGet, portalPost } from "@/lib/portalApi";

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

  const renderList = () => {
    if (!authed) {
      return (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Sign in required
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                Sign in to the Client Portal to view and complete assigned surveys.
              </p>
              <Button
                className="mt-4"
                onClick={() => {
                  window.location.href = "/portal/login";
                }}
                data-testid="button-surveys-login"
              >
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (listQuery.isLoading) {
      return (
        <div
          className="flex items-center justify-center py-16 text-gray-500"
          data-testid="surveys-loading"
        >
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading surveys…
        </div>
      );
    }

    if (listQuery.isError) {
      return (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-300">
                Couldn’t load surveys
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                {listQuery.error instanceof Error
                  ? listQuery.error.message
                  : "Unknown error"}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => listQuery.refetch()}
                data-testid="button-surveys-retry"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Surveys</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Complete CSAT, onboarding, and security awareness surveys assigned to
            your account.
          </p>
          <div className="flex gap-2 mt-3">
            <Badge variant="secondary" data-testid="badge-pending-count">
              {listQuery.data?.pendingCount ?? 0} pending
            </Badge>
            <Badge variant="outline" data-testid="badge-completed-count">
              {listQuery.data?.completedCount ?? 0} completed
            </Badge>
          </div>
        </div>

        {pendingSurveys.length === 0 && (
          <Card
            className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            data-testid="surveys-empty-pending"
          >
            <CardContent className="pt-6 text-center">
              <CheckCircle className="mx-auto mb-2 text-green-600" size={36} />
              <p className="font-medium text-green-800 dark:text-green-300">
                You’re all caught up
              </p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                No surveys are waiting right now. New CSAT or awareness checks will
                appear here when assigned.
              </p>
            </CardContent>
          </Card>
        )}

        {pendingSurveys.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Available
            </h3>
            {pendingSurveys.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSubmitSuccess(false);
                  setSelectedId(item.id);
                }}
                data-testid={`survey-card-${item.slug}`}
              >
                <CardContent className="pt-4 flex justify-between items-center gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <ClipboardList className="h-5 w-5 text-[#D3126A] mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{item.title}</p>
                        <Badge variant="secondary">
                          {CATEGORY_LABELS[item.category] || item.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {item.description}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.questionCount} question
                        {item.questionCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    data-testid={`button-start-${item.slug}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSubmitSuccess(false);
                      setSelectedId(item.id);
                    }}
                  >
                    Start
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {completedSurveys.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Completed
            </h3>
            {completedSurveys.map((item) => (
              <Card
                key={item.id}
                className="opacity-90"
                data-testid={`survey-completed-${item.slug}`}
              >
                <CardContent className="pt-4 flex justify-between items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{item.title}</p>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Completed
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
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
                </CardContent>
              </Card>
            ))}
          </div>
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
        <div key={q.id} className="space-y-2" data-testid={`question-${q.id}`}>
          <Label>
            {q.label}
            {q.required ? " *" : ""}
          </Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                disabled={readOnly}
                onClick={() => setAnswer(q.id, star)}
                onMouseEnter={() =>
                  !readOnly && setHoveredStar((h) => ({ ...h, [q.id]: star }))
                }
                onMouseLeave={() =>
                  setHoveredStar((h) => ({ ...h, [q.id]: 0 }))
                }
                className="transition-transform hover:scale-110 disabled:opacity-70"
                data-testid={`button-star-${q.id}-${star}`}
              >
                <Star
                  size={36}
                  className={`transition-colors ${
                    star <= (hover || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300 dark:text-gray-600"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (q.type === "text") {
      return (
        <div key={q.id} className="space-y-2" data-testid={`question-${q.id}`}>
          <Label htmlFor={`q-${q.id}`}>
            {q.label}
            {q.required ? " *" : ""}
          </Label>
          {q.helpText && (
            <p className="text-xs text-gray-500">{q.helpText}</p>
          )}
          <Textarea
            id={`q-${q.id}`}
            value={String(value || "")}
            disabled={readOnly}
            onChange={(e) => setAnswer(q.id, e.target.value)}
            className="min-h-24"
            data-testid={`textarea-${q.id}`}
          />
        </div>
      );
    }

    if (q.type === "single") {
      return (
        <div key={q.id} className="space-y-2" data-testid={`question-${q.id}`}>
          <Label>
            {q.label}
            {q.required ? " *" : ""}
          </Label>
          <div className="space-y-2">
            {(q.options || []).map((option) => {
              const selected = String(value || "") === option;
              return (
                <label
                  key={option}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer ${
                    selected
                      ? "border-[#D3126A] bg-[#D3126A]/5"
                      : "border-gray-200 dark:border-gray-700"
                  } ${readOnly ? "opacity-80 cursor-default" : ""}`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={option}
                    checked={selected}
                    disabled={readOnly}
                    onChange={() => setAnswer(q.id, option)}
                    className="accent-[#D3126A]"
                    data-testid={`radio-${q.id}-${option.slice(0, 24)}`}
                  />
                  <span className="text-sm">{option}</span>
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    // multi
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div key={q.id} className="space-y-2" data-testid={`question-${q.id}`}>
        <Label>
          {q.label}
          {q.required ? " *" : ""}
        </Label>
        <div className="space-y-2">
          {(q.options || []).map((option) => {
            const checked = selected.includes(option);
            return (
              <label
                key={option}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer ${
                  checked
                    ? "border-[#D3126A] bg-[#D3126A]/5"
                    : "border-gray-200 dark:border-gray-700"
                } ${readOnly ? "opacity-80 cursor-default" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={readOnly}
                  onChange={() => toggleMulti(q.id, option)}
                  className="accent-[#D3126A]"
                  data-testid={`check-${q.id}-${option.slice(0, 24)}`}
                />
                <span className="text-sm">{option}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDetail = () => {
    if (submitSuccess) {
      return (
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="mx-auto mb-2 text-green-600" size={40} />
            <p className="text-green-700 dark:text-green-300 font-medium">
              Thank you — your responses were saved.
            </p>
          </CardContent>
        </Card>
      );
    }

    if (detailQuery.isLoading) {
      return (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading survey…
        </div>
      );
    }

    if (detailQuery.isError || !survey) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 space-y-3">
            <p className="text-red-800 text-sm">
              {detailQuery.error instanceof Error
                ? detailQuery.error.message
                : "Survey not found"}
            </p>
            <Button variant="outline" onClick={() => setSelectedId(null)}>
              Back to surveys
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => {
            setSelectedId(null);
            setAnswers({});
            submitMutation.reset();
          }}
          data-testid="button-back-to-surveys"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to surveys
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{survey.title}</CardTitle>
              <Badge variant="secondary">
                {CATEGORY_LABELS[survey.category] || survey.category}
              </Badge>
              {alreadyCompleted && (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Completed
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {survey.description}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {survey.questions.map(renderQuestion)}

            {submitMutation.isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {submitMutation.error instanceof Error
                  ? submitMutation.error.message
                  : "Submit failed"}
              </div>
            )}

            {!alreadyCompleted && (
              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitMutation.isPending}
                  className="flex-1 bg-[#D3126A] hover:bg-[#e01874]"
                  data-testid="button-submit-survey"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    "Submit Survey"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedId(null)}
                  data-testid="button-cancel-survey"
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <PortalLayout title="Surveys">
      {selectedId ? renderDetail() : renderList()}
    </PortalLayout>
  );
}
