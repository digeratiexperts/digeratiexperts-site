import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  ArrowRight,
  Building,
  Building2,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Cloud,
  FileCheck,
  HeadphonesIcon,
  HelpCircle,
  Laptop,
  Loader2,
  Minus,
  Plus,
  Scale,
  ShieldCheck,
  Shuffle,
  TrendingUp,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { analytics } from '@/lib/analytics';
import { useToast } from '@/hooks/use-toast';
import { useSEO } from '@/hooks/useSEO';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { isValidCorporateEmail } from '@/lib/emailValidator';
import { cn } from '@/lib/utils';
import { describeMatchBasis, getPlanMatch, type TriState } from '@/lib/quoteMatch';
import { buttonPrimary, buttonSecondary, textLinkClass } from '@/components/site/chapters';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { QuizRoomShell } from '@/components/quote/QuizRoomShell';
import { QuizTile } from '@/components/quote/QuizTile';
import {
  FRAMEWORK_OPTIONS,
  IT_TODAY_OPTIONS,
  TRIGGER_OPTIONS,
  sanitizeQuoteContext,
  type FrameworkId,
  type ItTodayId,
  type TriggerId,
} from '@shared/quoteContext';

/*
 * /quote-wizard as a quiz room (issue 419): one question per screen, large
 * tiles, tap to answer. Same plan match (lib/quoteMatch.ts), same POST
 * /api/lead-quote payload (plus the optional `context` answers), same
 * /quote-confirmation hand-off. The plan is shown before the email is asked for.
 */

const contactSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  company: z.string().min(2, 'Company name must be at least 2 characters'),
  email: z.string().email('Invalid email format').refine(
    isValidCorporateEmail,
    'Please use your company email address, not a personal email'
  ),
  // Required so the scheduled call has a number to dial (issue 449).
  phone: z
    .string()
    .trim()
    .refine(
      (v) => /^[+\d\s().-]{7,40}$/.test(v) && (v.match(/\d/g)?.length ?? 0) >= 10,
      'Enter a phone number with area code',
    ),
  consent: z.boolean().refine(val => val === true, 'You must agree to be contacted'),
});
type ContactData = z.infer<typeof contactSchema>;

interface Answers {
  seats: number;
  enterpriseToggle: boolean;
  connectivity?: TriState;
  devices?: TriState;
  itToday?: ItTodayId;
  trigger?: TriggerId;
  frameworks: FrameworkId[];
}

type StepId = 'seats' | 'connectivity' | 'devices' | 'itToday' | 'trigger' | 'frameworks' | 'match' | 'contact';

interface StepDef {
  id: StepId;
  stage: number;
  /** Analytics step name. */
  name: string;
}

const STAGE_LABELS = ['Your team', 'Your setup', 'Your situation', 'Your match'];

const STEPS: StepDef[] = [
  { id: 'seats', stage: 0, name: 'team_size' },
  { id: 'connectivity', stage: 1, name: 'connectivity' },
  { id: 'devices', stage: 1, name: 'devices' },
  { id: 'itToday', stage: 2, name: 'it_today' },
  { id: 'trigger', stage: 2, name: 'trigger' },
  { id: 'frameworks', stage: 2, name: 'frameworks' },
  { id: 'match', stage: 3, name: 'plan_reveal' },
  { id: 'contact', stage: 3, name: 'lead_capture' },
];
const QUESTION_COUNT = STEPS.filter((s) => s.stage < 3).length;

const SEAT_CHIPS = [5, 10, 20, 30, 50] as const;
const MAX_SEATS = 100;
const ADVANCE_DELAY_MS = 250;
const STORAGE_KEY = 'deQuoteQuiz';

const CONNECTIVITY_OPTIONS: { id: TriState; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'yes', label: 'Yes', hint: 'Remote staff, more than one site, or files in the cloud', icon: Cloud },
  { id: 'no', label: 'No', hint: 'One office, files stay on site', icon: Building2 },
  { id: 'not-sure', label: 'Not sure', hint: "We'll work it out together", icon: HelpCircle },
];

const DEVICE_OPTIONS: { id: TriState; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'yes', label: 'Yes, manage them', hint: 'Patching, protection and backup handled for you', icon: Laptop },
  { id: 'no', label: 'No, devices are covered', hint: 'Someone already looks after them', icon: ShieldCheck },
  { id: 'not-sure', label: 'Not sure yet', hint: "We'll check what you have", icon: HelpCircle },
];

const IT_TODAY_ICONS: Record<ItTodayId, LucideIcon> = {
  nobody: Shuffle,
  'one-person': User,
  provider: Building,
  'internal-team': Users,
};

const TRIGGER_ICONS: Record<TriggerId, LucideIcon> = {
  insurance: FileCheck,
  incident: AlertTriangle,
  support: HeadphonesIcon,
  growth: TrendingUp,
  audit: ClipboardCheck,
  comparing: Scale,
};

const DEFAULT_ANSWERS: Answers = { seats: 10, enterpriseToggle: false, frameworks: [] };

/** Same paper-field recipe as the contact form — dark ink on white inputs. */
const paperFieldClass =
  "h-12 bg-white border-[var(--de-paper-hairline)] text-base text-[#1A1228] placeholder:text-black/55 focus-visible:ring-2 focus-visible:ring-[#D3126A]/40 focus-visible:border-[#D3126A]";

const eyebrowClass = "font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-magenta-paper-ink";
const headlineClass =
  "font-heading text-[1.75rem] font-bold leading-[1.1] tracking-[-0.025em] text-[#1A1228] focus:outline-none md:text-[2.5rem]";
const whyClass = "mt-3 max-w-xl text-base leading-relaxed text-black/65 md:text-lg";

function readStoredAnswers(): Answers {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ANSWERS;
    const parsed = JSON.parse(raw) as Partial<Answers>;
    const seats = Number(parsed.seats);
    const context = sanitizeQuoteContext(parsed);
    const tri = (v: unknown): TriState | undefined => (v === 'yes' || v === 'no' || v === 'not-sure' ? v : undefined);
    return {
      seats: Number.isInteger(seats) && seats >= 1 && seats <= MAX_SEATS ? seats : DEFAULT_ANSWERS.seats,
      enterpriseToggle: parsed.enterpriseToggle === true,
      connectivity: tri(parsed.connectivity),
      devices: tri(parsed.devices),
      itToday: context?.itToday,
      trigger: context?.trigger,
      frameworks: context?.frameworks ?? [],
    };
  } catch {
    return DEFAULT_ANSWERS;
  }
}

function writeStoredAnswers(answers: Answers) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch {
    /* private mode / blocked storage: the quiz still works, it just won't survive a reload */
  }
}

function clearStoredAnswers() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Where Exit goes: the same-site page they came from, else home. */
function resolveExitHref(): string {
  try {
    if (!document.referrer) return '/';
    const ref = new URL(document.referrer);
    if (ref.origin !== window.location.origin || ref.pathname === window.location.pathname) return '/';
    return `${ref.pathname}${ref.search}`;
  } catch {
    return '/';
  }
}

export default function LeadQuoteWizard() {
  useSEO({
    title: 'Find Your Plan - Managed IT & Cybersecurity',
    description:
      "Answer a few questions about your team and setup, and we'll match you to the DE plan that fits: IT, Office, Business or Enterprise.",
    canonical: '/quote-wizard',
  });

  const reduceMotion = useReducedMotion();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [answers, setAnswers] = useState<Answers>(readStoredAnswers);
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exitHref, setExitHref] = useState('/');
  const advancing = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const headingId = useId();
  const whyId = useId();

  const step = STEPS[stepIndex];

  useEffect(() => {
    analytics.quoteWizardStarted();
    setExitHref(resolveExitHref());
  }, []);

  useEffect(() => {
    writeStoredAnswers(answers);
  }, [answers]);

  // Each new screen: move focus to its question (not on first load, so the
  // sitewide skip link and the browser keep their own focus), and scroll up.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  // Browser and hardware Back walk the screens instead of leaving the quiz.
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const target = (event.state as { deQuizStep?: unknown } | null)?.deQuizStep;
      advancing.current = false;
      setStepIndex(typeof target === 'number' && target >= 0 && target < STEPS.length ? target : 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const goTo = useCallback((next: number) => {
    advancing.current = false;
    if (next < 0 || next >= STEPS.length) return;
    analytics.quoteWizardStep(next + 1, STEPS[next].name);
    try {
      window.history.pushState({ ...(window.history.state ?? {}), deQuizStep: next }, '', window.location.href);
    } catch {
      /* history unavailable: in-page Back still works */
    }
    setStepIndex(next);
  }, []);

  const goBack = useCallback(() => {
    if (stepIndex === 0) return;
    const state = window.history.state as { deQuizStep?: unknown } | null;
    if (state?.deQuizStep === stepIndex) {
      window.history.back();
    } else {
      setStepIndex(stepIndex - 1);
    }
  }, [stepIndex]);

  /** Record a single-choice answer, show it selected for a beat, then move on. */
  const answerAndAdvance = useCallback(
    (patch: Partial<Answers>) => {
      if (advancing.current) return;
      advancing.current = true;
      setAnswers((prev) => ({ ...prev, ...patch }));
      const next = stepIndex + 1;
      window.setTimeout(() => goTo(next), ADVANCE_DELAY_MS);
    },
    [goTo, stepIndex],
  );

  const match = useMemo(
    () =>
      getPlanMatch({
        seats: answers.seats,
        enterpriseToggle: answers.enterpriseToggle,
        connectivity: answers.connectivity ?? 'not-sure',
        devices: answers.devices ?? 'not-sure',
      }),
    [answers.seats, answers.enterpriseToggle, answers.connectivity, answers.devices],
  );

  const form = useForm<ContactData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { firstName: '', lastName: '', company: '', email: '', phone: '', consent: false },
  });

  const handleSubmit = async (data: ContactData) => {
    setIsSubmitting(true);

    try {
      const connectivity = answers.connectivity ?? 'not-sure';
      const devices = answers.devices ?? 'not-sure';
      const plan = getPlanMatch({
        seats: answers.seats,
        enterpriseToggle: answers.enterpriseToggle,
        connectivity,
        devices,
      });
      const context = sanitizeQuoteContext({
        itToday: answers.itToday,
        trigger: answers.trigger,
        frameworks: answers.frameworks,
      });

      const payload = {
        seats: answers.seats,
        enterpriseToggle: answers.enterpriseToggle,
        connectivity,
        devices,
        recommendedPlan: plan.plan,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company,
        email: data.email,
        phone: data.phone,
        consent: data.consent,
        source: 'header-instant-quote',
        pageUrl: window.location.href,
        timestamp: new Date().toISOString(),
        ...(context ? { context } : {}),
      };

      const response = await fetch('/api/lead-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to submit form');

      analytics.quoteWizardCompleted({ users: answers.seats });

      // Navigate to confirmation page with data
      sessionStorage.setItem('leadQuoteResult', JSON.stringify({
        plan: plan.plan,
        reasons: plan.reasons,
        firstName: data.firstName,
        company: data.company,
      }));
      clearStoredAnswers();

      setLocation('/quote-confirmation');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process your request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stages = STAGE_LABELS.map((label, i) => {
    const inStage = STEPS.map((s, idx) => ({ ...s, idx })).filter((s) => s.stage === i);
    const done = inStage.filter((s) => s.idx < stepIndex).length;
    return { label, fill: done / inStage.length };
  });
  const isQuestion = step.stage < 3;
  const counter = isQuestion
    ? `${String(stepIndex + 1).padStart(2, '0')} / ${String(QUESTION_COUNT).padStart(2, '0')}`
    : null;
  const progressLabel = isQuestion
    ? `Question ${stepIndex + 1} of ${QUESTION_COUNT}, ${STAGE_LABELS[step.stage]}`
    : STAGE_LABELS[3];
  const progressValue = (stepIndex / (STEPS.length - 1)) * 100;

  const heading = (text: ReactNode) => (
    <h1 id={headingId} ref={headingRef} tabIndex={-1} className={headlineClass}>
      {text}
    </h1>
  );
  const why = (text: string) => (
    <p id={whyId} className={whyClass}>
      {text}
    </p>
  );
  const tileGroup = (children: ReactNode, columns: 1 | 2 = 1) => (
    <div
      role="group"
      aria-labelledby={headingId}
      aria-describedby={whyId}
      className={cn('mt-8 grid gap-3 md:mt-10', columns === 2 && 'md:grid-cols-2')}
    >
      {children}
    </div>
  );
  const skipLink = (
    <button
      type="button"
      onClick={() => goTo(stepIndex + 1)}
      className={cn(textLinkClass('paper'), 'mt-6 min-h-11')}
      data-testid="quiz-skip"
    >
      Skip this question
    </button>
  );

  const setSeats = (value: number) => {
    const seats = Math.min(MAX_SEATS, Math.max(1, Math.round(value) || 1));
    setAnswers((prev) => ({ ...prev, seats, enterpriseToggle: false }));
  };

  let body: ReactNode;
  switch (step.id) {
    case 'seats':
      body = (
        <>
          {heading('How many people need IT that just works?')}
          {why("Count people, not devices. It's the biggest factor in which plan fits.")}
          <div className="mt-8 rounded-2xl border border-[var(--de-paper-hairline)] bg-white p-5 md:mt-10 md:p-8">
            <div className="flex items-center justify-center gap-4 md:gap-6">
              <button
                type="button"
                className={cn(buttonSecondary('paper'), 'h-14 w-14 px-0')}
                onClick={() => setSeats((answers.enterpriseToggle ? MAX_SEATS : answers.seats) - 1)}
                disabled={!answers.enterpriseToggle && answers.seats <= 1}
                aria-label="One fewer person"
              >
                <Minus className="h-5 w-5" aria-hidden="true" />
              </button>
              <label className="flex flex-col items-center">
                <span className="sr-only">Number of people</span>
                {answers.enterpriseToggle ? (
                  <span className="font-mono text-6xl font-bold leading-none text-[#1A1228] md:text-7xl" data-testid="seat-count">
                    100+
                  </span>
                ) : (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_SEATS}
                    value={answers.seats}
                    onChange={(e) => setSeats(Number(e.target.value))}
                    className="w-[3.2ch] appearance-none rounded-lg bg-transparent text-center font-mono text-6xl font-bold leading-none text-[#1A1228] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] md:text-7xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    data-testid="seat-count"
                  />
                )}
                <span className="mt-2 text-sm text-black/60">{answers.enterpriseToggle || answers.seats !== 1 ? 'people' : 'person'}</span>
              </label>
              <button
                type="button"
                className={cn(buttonSecondary('paper'), 'h-14 w-14 px-0')}
                onClick={() =>
                  answers.seats >= MAX_SEATS
                    ? setAnswers((prev) => ({ ...prev, seats: MAX_SEATS, enterpriseToggle: true }))
                    : setSeats(answers.seats + 1)
                }
                disabled={answers.enterpriseToggle}
                aria-label="One more person"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Quick picks">
              {SEAT_CHIPS.map((n) => {
                const on = !answers.enterpriseToggle && answers.seats === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSeats(n)}
                    className={cn(
                      'inline-flex min-h-11 min-w-14 items-center justify-center rounded-full border px-4 font-mono text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2',
                      on ? 'border-[#D3126A] bg-[#D3126A] text-white' : 'border-[var(--de-paper-hairline)] bg-white text-[#1A1228] hover:border-[#1A1228]/30',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={answers.enterpriseToggle}
                onClick={() => setAnswers((prev) => ({ ...prev, seats: MAX_SEATS, enterpriseToggle: true }))}
                className={cn(
                  'inline-flex min-h-11 items-center justify-center rounded-full border px-4 font-mono text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2',
                  answers.enterpriseToggle ? 'border-[#D3126A] bg-[#D3126A] text-white' : 'border-[var(--de-paper-hairline)] bg-white text-[#1A1228] hover:border-[#1A1228]/30',
                )}
                data-testid="seat-chip-100plus"
              >
                100+
              </button>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" className={cn(buttonPrimary('paper'), 'w-full sm:w-auto')} onClick={() => goTo(1)} data-testid="quiz-continue">
              Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <a href="/book" className={cn(textLinkClass('paper'), 'min-h-11 justify-center sm:justify-start')} data-testid="quiz-talk">
              Rather talk it through? Book a call
            </a>
          </div>
        </>
      );
      break;

    case 'connectivity':
      body = (
        <>
          {heading('Does your team work remotely, across sites, or keep files in the cloud?')}
          {why('Remote access and cloud storage widen what has to be secured and watched.')}
          {tileGroup(
            CONNECTIVITY_OPTIONS.map((o) => (
              <QuizTile
                key={o.id}
                label={o.label}
                hint={o.hint}
                icon={o.icon}
                selected={answers.connectivity === o.id}
                onSelect={() => answerAndAdvance({ connectivity: o.id })}
                testId={`tile-connectivity-${o.id}`}
              />
            )),
          )}
        </>
      );
      break;

    case 'devices':
      body = (
        <>
          {heading('Should we look after your laptops and desktops?')}
          {why('Managed devices get patched, backed up and protected without anyone on your team chasing it.')}
          {tileGroup(
            DEVICE_OPTIONS.map((o) => (
              <QuizTile
                key={o.id}
                label={o.label}
                hint={o.hint}
                icon={o.icon}
                selected={answers.devices === o.id}
                onSelect={() => answerAndAdvance({ devices: o.id })}
                testId={`tile-devices-${o.id}`}
              />
            )),
          )}
        </>
      );
      break;

    case 'itToday':
      body = (
        <>
          {heading('Who handles IT today?')}
          {why("Tells us whether to run it or work alongside someone. It doesn't change your plan.")}
          {tileGroup(
            IT_TODAY_OPTIONS.map((o) => (
              <QuizTile
                key={o.id}
                label={o.label}
                icon={IT_TODAY_ICONS[o.id]}
                selected={answers.itToday === o.id}
                onSelect={() => answerAndAdvance({ itToday: o.id })}
                testId={`tile-itToday-${o.id}`}
              />
            )),
            2,
          )}
          {skipLink}
        </>
      );
      break;

    case 'trigger':
      body = (
        <>
          {heading('What made you look now?')}
          {why('Tells whoever follows up where to start.')}
          {tileGroup(
            TRIGGER_OPTIONS.map((o) => (
              <QuizTile
                key={o.id}
                label={o.label}
                icon={TRIGGER_ICONS[o.id]}
                selected={answers.trigger === o.id}
                onSelect={() => answerAndAdvance({ trigger: o.id })}
                testId={`tile-trigger-${o.id}`}
              />
            )),
            2,
          )}
          {skipLink}
        </>
      );
      break;

    case 'frameworks': {
      const toggle = (id: FrameworkId) =>
        setAnswers((prev) => {
          const has = prev.frameworks.includes(id);
          if (id === 'none') return { ...prev, frameworks: has ? [] : ['none'] };
          const rest = prev.frameworks.filter((f) => f !== 'none' && f !== id);
          return { ...prev, frameworks: has ? rest : [...rest, id] };
        });
      body = (
        <>
          {heading('Any rules you have to follow?')}
          {why("Frameworks shape the controls we put in. Pick any that apply; 'not sure' is a fine answer.")}
          {tileGroup(
            FRAMEWORK_OPTIONS.map((o) => (
              <QuizTile
                key={o.id}
                label={o.label}
                multi
                selected={answers.frameworks.includes(o.id)}
                onSelect={() => toggle(o.id)}
                testId={`tile-frameworks-${o.id}`}
              />
            )),
            2,
          )}
          <div className="mt-8">
            <button type="button" className={cn(buttonPrimary('paper'), 'w-full sm:w-auto')} onClick={() => goTo(stepIndex + 1)} data-testid="quiz-continue">
              {answers.frameworks.length ? 'Continue' : 'Not sure, continue'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </>
      );
      break;
    }

    case 'match':
      body = (
        <>
          <h1 id={headingId} ref={headingRef} tabIndex={-1} className={cn(headlineClass, 'text-[2.75rem] leading-[1.05] md:text-[4rem] md:leading-[1.05]')}>
            <span className="sr-only">Your match: </span>
            <span className="font-bold" data-testid="match-plan">{match.plan}</span>
            <span className="font-bold text-[#D3126A]" aria-hidden="true">.</span>
          </h1>
          {why(`${describeMatchBasis(answers)} A plan, not a price: we scope that with you.`)}
          <div className="mt-8 rounded-2xl border border-[var(--de-paper-hairline)] bg-white p-5 md:mt-10 md:p-8">
            <p className={eyebrowClass}>Why {match.plan} fits</p>
            <ul className="mt-4 space-y-3" data-testid="match-reasons">
              {match.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-3 text-base leading-relaxed text-[#1A1228]">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#D3126A] text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <button type="button" className={cn(buttonPrimary('paper'), 'w-full sm:w-auto')} onClick={() => goTo(stepIndex + 1)} data-testid="quiz-continue">
              Send me this plan <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <a href="/book" className={cn(textLinkClass('paper'), 'min-h-11 justify-center sm:justify-start')}>
              Or book a call to talk it through
            </a>
          </div>
        </>
      );
      break;

    case 'contact':
      body = (
        <>
          {heading('Where should we send it?')}
          {why("Work email and a direct number. We'll use them to follow up about this plan.")}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              noValidate
              className="mt-8 space-y-5 rounded-2xl border border-[var(--de-paper-hairline)] bg-white p-5 md:mt-10 md:p-8"
              data-testid="quiz-contact-form"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem required>
                    <FormLabel className="text-[#1A1228]">Work email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" placeholder="you@company.com" className={paperFieldClass} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem required>
                    <FormLabel className="text-[#1A1228]">Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="(480) 555-0100" className={paperFieldClass} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem required>
                      <FormLabel className="text-[#1A1228]">First name</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" className={paperFieldClass} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem required>
                      <FormLabel className="text-[#1A1228]">Last name</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" className={paperFieldClass} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem required>
                    <FormLabel className="text-[#1A1228]">Company</FormLabel>
                    <FormControl>
                      <Input autoComplete="organization" className={paperFieldClass} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 accent-[#A30E52]"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 text-sm font-normal leading-relaxed text-[#1A1228]">
                        I agree to be contacted about my plan match. See our{' '}
                        <a href="/legal/privacy-policy" className="font-semibold text-de-magenta-paper-ink underline underline-offset-2">
                          privacy policy
                        </a>
                        .
                      </FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button type="submit" className={cn(buttonPrimary('paper'), 'w-full sm:w-auto')} disabled={isSubmitting} data-testid="quiz-submit">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Send my {match.plan} plan
              </button>
            </form>
          </Form>
        </>
      );
      break;
  }

  return (
    <QuizRoomShell
      stages={stages}
      currentStage={step.stage}
      progressLabel={progressLabel}
      progressValue={progressValue}
      exitHref={exitHref}
    >
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 pb-12 focus:outline-none md:pb-20"
      >
        <div className="mx-auto w-full max-w-[720px] px-4 pt-4 md:px-8 md:pt-10">
          <div className="flex min-h-11 items-center">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#1A1228]/75 hover:text-[#1A1228] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                data-testid="quiz-back"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
              </button>
            ) : null}
          </div>
          <p className={cn(eyebrowClass, 'mt-3 md:mt-5')} data-testid="quiz-eyebrow">
            {STAGE_LABELS[step.stage]}
            {counter ? <span className="font-semibold text-[#1A1228]/65"> · {counter}</span> : null}
            {step.id === 'contact' ? <span className="font-semibold text-[#1A1228]/65"> · Last step</span> : null}
          </p>
          <p className="sr-only" aria-live="polite">
            {progressLabel}
          </p>
          <motion.div
            key={step.id}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mt-3"
            data-testid={`quiz-step-${step.id}`}
          >
            {body}
          </motion.div>
        </div>
      </main>
    </QuizRoomShell>
  );
}
