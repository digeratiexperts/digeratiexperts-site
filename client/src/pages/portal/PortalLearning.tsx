import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Compass,
  ExternalLink,
  GraduationCap,
  Library,
  Sparkles,
  Clock,
  ArrowRight,
  Shield,
  Target,
} from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { portalGet } from "@/lib/portalApi";
import { readPortalUser } from "@/lib/portalRoles";

type Lesson = {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  minutes: number;
  pillar: string;
  steps: string[];
  actions: Array<{ label: string; href: string; external?: boolean }>;
  hubDocSlugs?: string[];
  badge?: string;
};

type LearningResponse = {
  audience: string;
  roleLabel: string;
  recommendedMinutes: number;
  catalogVersion: string;
  path: {
    id: string;
    title: string;
    tagline: string;
    mission: string;
    lessonIds: string[];
  };
  lessons: Lesson[];
  pillars: Array<{ key: string; label: string; blurb: string; lessonCount: number }>;
  hub: {
    source: string;
    resources: Array<{
      slug: string;
      title: string;
      category?: string;
      description?: string;
    }>;
  };
  allPaths?: Array<{
    id: string;
    title: string;
    tagline: string;
    audience: string;
    lessonCount: number;
  }>;
};

const PROGRESS_KEY = "portalLearningProgress_v1";

function loadProgress(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(map: Record<string, boolean>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
}

export default function PortalLearning() {
  const user = readPortalUser();
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pillarFilter, setPillarFilter] = useState<string | "all">("all");

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const { data, isLoading, isError, error } = useQuery<LearningResponse>({
    queryKey: ["/api/portal/learning"],
    queryFn: () => portalGet<LearningResponse>("/api/portal/learning"),
  });

  const lessons = data?.lessons || [];
  const doneCount = useMemo(
    () => lessons.filter((l) => progress[l.id]).length,
    [lessons, progress],
  );
  const pct = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;

  const visible = useMemo(() => {
    if (pillarFilter === "all") return lessons;
    return lessons.filter((l) => l.pillar === pillarFilter);
  }, [lessons, pillarFilter]);

  const active = lessons.find((l) => l.id === activeId) || visible[0] || null;

  useEffect(() => {
    if (!activeId && lessons[0]) setActiveId(lessons[0].id);
  }, [lessons, activeId]);

  const toggleDone = (id: string) => {
    setProgress((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveProgress(next);
      return next;
    });
  };

  return (
    <PortalLayout title="Learning Center" hideHeader>
      <div className="space-y-6">
        {/* Immersive role banner */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-white">
          <div
            className="absolute inset-0 opacity-80"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 10% 20%, rgba(80,52,255,0.45), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 80%, rgba(14,165,233,0.28), transparent 50%), linear-gradient(160deg, #0b1220 0%, #111827 55%, #0f172a 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative p-6 md:p-8 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-white/10 hover:bg-white/15 text-white border-white/20">
                <GraduationCap className="h-3.5 w-3.5 mr-1" />
                Learning Center
              </Badge>
              <Badge variant="outline" className="border-sky-400/40 text-sky-100">
                {data?.roleLabel || "Your path"}
              </Badge>
              {data?.catalogVersion && (
                <Badge variant="outline" className="border-white/20 text-white/70 font-normal">
                  TechSales · {data.catalogVersion}
                </Badge>
              )}
            </div>
            <div className="max-w-3xl space-y-2">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {isLoading ? "Loading your path…" : data?.path.title || "Your learning path"}
              </h2>
              <p className="text-sky-100/90 text-sm md:text-base">
                {data?.path.tagline || "Role-specific training drawn from DE’s TechSales service map."}
              </p>
              <p className="text-white/75 text-sm leading-relaxed max-w-2xl">
                {data?.path.mission ||
                  "Lessons adapt to your portal role — staff, manager, department IT, or company IT."}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <ProgressRing pct={pct} />
              <div className="text-sm space-y-1">
                <p className="text-white/90 font-medium">
                  {doneCount} of {lessons.length} lessons marked complete
                </p>
                <p className="text-white/60 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  ~{data?.recommendedMinutes || 0} min on this path
                  {user?.fullName ? ` · ${user.fullName}` : ""}
                </p>
              </div>
            </div>
          </div>
        </section>

        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error instanceof Error ? error.message : "Failed to load learning path"}
          </div>
        )}

        {/* Pillar chips */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={pillarFilter === "all" ? "default" : "outline"}
            onClick={() => setPillarFilter("all")}
          >
            All lessons
          </Button>
          {data?.pillars.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={pillarFilter === p.key ? "default" : "outline"}
              onClick={() => setPillarFilter(p.key)}
              title={p.blurb}
            >
              {p.label}
              <span className="ml-1.5 text-xs opacity-70">{p.lessonCount}</span>
            </Button>
          ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-5">
          {/* Journey rail */}
          <div className="lg:col-span-4 space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Compass className="h-4 w-4 text-[#D3126A]" />
                  Your mission path
                </CardTitle>
                <CardDescription>Tap a stop to study it. Progress saves on this device.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 max-h-[560px] overflow-auto pr-1">
                {isLoading && <p className="text-sm text-muted-foreground py-4">Loading lessons…</p>}
                {visible.map((lesson, idx) => {
                  const done = !!progress[lesson.id];
                  const selected = active?.id === lesson.id;
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => setActiveId(lesson.id)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 transition border ${
                        selected
                          ? "border-[#D3126A]/50 bg-[#D3126A]/5"
                          : "border-transparent hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex gap-3 items-start">
                        <div className="mt-0.5 shrink-0">
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-muted-foreground">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            {lesson.badge && (
                              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                {lesson.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium leading-snug mt-0.5">{lesson.title}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{lesson.minutes} min</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {data?.allPaths && data.allPaths.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    All role paths
                  </CardTitle>
                  <CardDescription>DE admin view — what each client role sees</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.allPaths.map((p) => (
                    <div key={p.id} className="text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.tagline} · {p.lessonCount} lessons
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Active lesson */}
          <div className="lg:col-span-5 space-y-4">
            {active ? (
              <Card className="overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-[#D3126A] via-sky-500 to-emerald-400" />
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-xl leading-snug">{active.title}</CardTitle>
                      <CardDescription className="text-sm">{active.summary}</CardDescription>
                    </div>
                    <Badge variant="outline">{active.minutes} min</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-lg border border-amber-200/70 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-900/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Why it matters
                    </p>
                    <p className="text-sm mt-1.5 text-amber-950/90 dark:text-amber-100/90 leading-relaxed">
                      {active.whyItMatters}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#D3126A]" />
                      Walkthrough
                    </p>
                    <ol className="space-y-2.5">
                      {active.steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="shrink-0 h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-muted-foreground leading-relaxed pt-0.5">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {active.actions.map((a) =>
                      a.external ? (
                        <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            {a.label}
                          </Button>
                        </a>
                      ) : (
                        <Link key={a.label} href={a.href}>
                          <Button variant="outline" size="sm">
                            {a.label}
                            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                          </Button>
                        </Link>
                      ),
                    )}
                    <Button
                      size="sm"
                      variant={progress[active.id] ? "secondary" : "default"}
                      onClick={() => toggleDone(active.id)}
                    >
                      {progress[active.id] ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          Completed
                        </>
                      ) : (
                        <>Mark complete</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Select a lesson from your path.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Hub resources */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Library className="h-4 w-4" />
                  TechSales library
                </CardTitle>
                <CardDescription>
                  {data?.hub.source === "techsales"
                    ? "Pulled from your company document bridge"
                    : "Catalog references from the Hub curriculum map"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.hub.resources || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No educational docs linked yet. Company IT can open Contracts once TechSales sync is live.
                  </p>
                )}
                {(data?.hub.resources || []).slice(0, 8).map((doc) => (
                  <div key={doc.slug} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <p className="text-sm font-medium leading-snug">{doc.title}</p>
                    {doc.category && (
                      <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                        {String(doc.category).replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                ))}
                <Link href="/portal/contracts">
                  <Button variant="outline" size="sm" className="w-full mt-1">
                    <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                    Open contracts & docs
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-slate-50 dark:bg-slate-900/40">
              <CardContent className="pt-5 space-y-2">
                <p className="text-sm font-semibold">Role tip</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {roleTip(data?.audience)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} stroke="rgba(255,255,255,0.15)" strokeWidth="6" fill="none" />
        <circle
          cx="36"
          cy="36"
          r={r}
          stroke="url(#learnGrad)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="learnGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

function roleTip(audience?: string): string {
  switch (audience) {
    case "manager":
      return "Your Approvals queue is a security control. When someone leaves your team, start offboarding the same day — do not wait for HR paperwork to catch up.";
    case "dept_it_contact":
      return "Stabilize first, then escalate with a timeline. Live Chat is for coordination; tickets are for work that needs a trail.";
    case "company_it_contact":
      return "Own the program narrative: what is included, who approves access, and where evidence lives for insurance and customer questionnaires.";
    case "de_admin":
      return "You see every role path. Use this to coach clients into the right lessons — curriculum is aligned to Hub Core 36 + ecosystem includes.";
    default:
      return "Pause before you click. Use tickets instead of hallway fixes. MFA and sanctioned file locations keep your work recoverable.";
  }
}
