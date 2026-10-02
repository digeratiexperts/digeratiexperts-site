import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { BookOpen, CheckCircle2, Circle, ExternalLink, ArrowRight, Sparkles } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { portalGet } from "@/lib/portalApi";
import { readPortalUser } from "@/lib/portalRoles";
import { cn } from "@/lib/utils";
import { Callout, EmptyState, Panel, StatTile, Token } from "@/components/portal/ui";

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

const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
  );

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
    <PortalLayout
      title="Learning Center"
      eyebrow={data?.roleLabel || "Your path"}
      description={data?.path.tagline || "Role-specific training drawn from DE’s TechSales service map."}
      width="wide"
    >
      <div className="space-y-4">
        <Panel
          id="learning-path"
          title={isLoading ? "Loading your path…" : data?.path.title || "Your learning path"}
          description={data?.path.mission || "Lessons adapt to your portal role — staff, manager, department IT, or company IT."}
          actions={data?.catalogVersion ? <Token label={`TechSales · ${data.catalogVersion}`} /> : undefined}
        >
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Path progress">
              <StatTile
                label="Lessons complete"
                value={doneCount}
                suffix={`/${lessons.length}`}
                hint="marked on this device"
                tone={doneCount > 0 ? "ok" : "neutral"}
                loading={isLoading}
              />
              <StatTile label="Path progress" value={pct} suffix="%" hint={user?.fullName ? user.fullName : "your path"} loading={isLoading} />
              <StatTile label="Time on path" value={data?.recommendedMinutes || 0} suffix="min" hint="recommended" tone="info" loading={isLoading} className="col-span-2 lg:col-span-1" />
            </section>
            <Progress value={pct} className="h-2" aria-label="Path progress" />
          </div>
        </Panel>

        {isError && (
          <Callout tone="bad" title="Learning path couldn't be loaded">
            {error instanceof Error ? error.message : "Failed to load learning path"}
          </Callout>
        )}

        <div role="group" aria-label="Filter by pillar" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
          <button type="button" aria-pressed={pillarFilter === "all"} className={chipClass(pillarFilter === "all")} onClick={() => setPillarFilter("all")}>
            All lessons
          </button>
          {data?.pillars.map((p) => {
            const activeChip = pillarFilter === p.key;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={activeChip}
                className={chipClass(activeChip)}
                onClick={() => setPillarFilter(p.key)}
                title={p.blurb}
              >
                {p.label}
                <span className={cn("pt-num rounded-full px-1.5 text-[10px]", activeChip ? "bg-white/20" : "bg-muted")}>{p.lessonCount}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-4">
            <Panel id="mission-path" title="Your mission path" description="Tap a stop to study it. Progress saves on this device." flush>
              {isLoading && <p className="px-4 py-4 text-sm text-muted-foreground">Loading lessons…</p>}
              {!isLoading && visible.length === 0 && (
                <EmptyState compact icon={BookOpen} title="No lessons in this pillar" description="Pick another pillar or show all lessons." />
              )}
              <ul className="max-h-[560px] divide-y divide-border overflow-auto">
                {visible.map((lesson, idx) => {
                  const done = !!progress[lesson.id];
                  const selected = active?.id === lesson.id;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(lesson.id)}
                        aria-current={selected ? "true" : undefined}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none",
                          selected && "bg-accent/60",
                        )}
                      >
                        <span className="mt-0.5 shrink-0">
                          {done ? (
                            <CheckCircle2 className="pt-ink pt-tone-ok h-4 w-4" aria-label="Completed" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="pt-num text-xs text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
                            {lesson.badge && <Token label={lesson.badge} tone="brand" className="px-1.5 py-0 text-[9px]" />}
                          </span>
                          <span className="mt-0.5 block text-sm font-medium leading-snug">{lesson.title}</span>
                          <span className="pt-num mt-0.5 block text-xs text-muted-foreground">{lesson.minutes} min</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            {data?.allPaths && data.allPaths.length > 0 && (
              <Panel id="all-paths" title="All role paths" description="DE admin view — what each client role sees" flush>
                <ul className="divide-y divide-border">
                  {data.allPaths.map((p) => (
                    <li key={p.id} className="px-4 py-3 text-sm">
                      <p className="font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.tagline} · {p.lessonCount} lessons
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <div className="space-y-4 lg:col-span-5">
            {active ? (
              <Panel
                id="active-lesson"
                title={active.title}
                description={active.summary}
                actions={<Token label={`${active.minutes} min`} />}
              >
                <div className="space-y-5">
                  <Callout tone="warn" title="Why it matters">
                    {active.whyItMatters}
                  </Callout>

                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                      <Sparkles className="pt-link h-4 w-4" aria-hidden="true" />
                      Walkthrough
                    </p>
                    <ol className="space-y-2.5">
                      {active.steps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="pt-num grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-muted text-xs font-semibold">
                            {i + 1}
                          </span>
                          <span className="pt-0.5 leading-relaxed text-muted-foreground">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {active.actions.map((a) =>
                      a.external ? (
                        <Button key={a.label} asChild variant="outline" size="sm" className="border-border bg-card hover:bg-accent">
                          <a href={a.href} target="_blank" rel="noopener noreferrer">
                            <ExternalLink aria-hidden="true" />
                            {a.label}
                          </a>
                        </Button>
                      ) : (
                        <Button key={a.label} asChild variant="outline" size="sm" className="border-border bg-card hover:bg-accent">
                          <Link href={a.href}>
                            {a.label}
                            <ArrowRight aria-hidden="true" />
                          </Link>
                        </Button>
                      ),
                    )}
                    <Button
                      size="sm"
                      variant={progress[active.id] ? "outline" : "brand"}
                      className={progress[active.id] ? "border-border bg-card hover:bg-accent" : undefined}
                      aria-pressed={!!progress[active.id]}
                      onClick={() => toggleDone(active.id)}
                    >
                      {progress[active.id] ? (
                        <>
                          <CheckCircle2 className="pt-ink pt-tone-ok" aria-hidden="true" />
                          Completed
                        </>
                      ) : (
                        <>Mark complete</>
                      )}
                    </Button>
                  </div>
                </div>
              </Panel>
            ) : (
              <Panel id="active-lesson" flush>
                <EmptyState icon={BookOpen} title="Select a lesson from your path." description={isLoading ? "Loading lessons…" : "Your lessons appear in the mission path on the left."} />
              </Panel>
            )}
          </div>

          <div className="space-y-4 lg:col-span-3">
            <Panel
              id="hub-library"
              title="TechSales library"
              description={
                data?.hub.source === "techsales"
                  ? "Pulled from your company document bridge"
                  : "Catalog references from the Hub curriculum map"
              }
              flush
            >
              {(data?.hub.resources || []).length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No educational docs linked yet. Company IT can open Contracts once TechSales sync is live.
                </p>
              )}
              <ul className="divide-y divide-border">
                {(data?.hub.resources || []).slice(0, 8).map((doc) => (
                  <li key={doc.slug} className="px-4 py-2.5">
                    <p className="text-sm font-medium leading-snug">{doc.title}</p>
                    {doc.category && (
                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                        {String(doc.category).replace(/_/g, " ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-border p-3">
                <Button asChild variant="outline" size="sm" className="w-full border-border bg-card hover:bg-accent">
                  <Link href="/portal/contracts">
                    <BookOpen aria-hidden="true" />
                    Open contracts & docs
                  </Link>
                </Button>
              </div>
            </Panel>

            <Callout tone="info" title="Role tip">
              {roleTip(data?.audience)}
            </Callout>
          </div>
        </div>
      </div>
    </PortalLayout>
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
