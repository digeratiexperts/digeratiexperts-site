import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Mail, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_GUIDED_ANSWERS,
  GUIDED_BUYER_OPTIONS,
  GUIDED_LOCATION_OPTIONS,
  GUIDED_OBJECTIVE_OPTIONS,
  GUIDED_SIZE_OPTIONS,
  buildGuidedRecommendation,
  type GuidedBuyingAnswers,
  type GuidedRecommendation,
} from "@/data/storeMerchandising";
import type { StoreProduct } from "@/data/storeProducts";
import {
  isWorkEmail,
  markGuidedCompleted,
  markGuidedSkipped,
  startStoreBuyerAuth,
} from "@/lib/storeGuidedSession";

const SLIDE_COUNT = 3;

interface GuidedBuyingWizardProps {
  variant?: "drawer" | "inline";
  open?: boolean;
  onClose?: () => void;
  onAddStack?: (products: StoreProduct[], seatHint: number) => void;
  onSkipCatalog?: () => void;
  onComplete?: (recommendation: GuidedRecommendation, answers: GuidedBuyingAnswers) => void;
  signedInEmail?: string;
}

function SkipCatalogLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-white/55 underline-offset-4 hover:text-white/70 hover:underline"
      data-testid="button-skip-full-catalog"
    >
      Browse the full catalog
    </button>
  );
}

export function GuidedBuyingWizard({
  variant = "drawer",
  open = false,
  onClose,
  onAddStack,
  onSkipCatalog,
  onComplete,
  signedInEmail,
}: GuidedBuyingWizardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<GuidedBuyingAnswers>(() => ({
    ...DEFAULT_GUIDED_ANSWERS,
    workEmail: signedInEmail?.trim().toLowerCase() || "",
  }));
  const [authHint, setAuthHint] = useState("");

  useEffect(() => {
    if (signedInEmail && isWorkEmail(signedInEmail) && !answers.workEmail) {
      setAnswers((prev) => ({ ...prev, workEmail: signedInEmail.trim().toLowerCase() }));
    }
  }, [signedInEmail, answers.workEmail]);

  const recommendation = useMemo(() => buildGuidedRecommendation(answers), [answers]);
  const progress = Math.round(((step + 1) / SLIDE_COUNT) * 100);
  const emailReady = isWorkEmail(answers.workEmail);
  const visible = variant === "inline" || open;

  const reset = () => {
    setStep(0);
    setAnswers({
      ...DEFAULT_GUIDED_ANSWERS,
      workEmail: signedInEmail?.trim().toLowerCase() || "",
    });
    setAuthHint("");
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleSkip = () => {
    markGuidedSkipped();
    onSkipCatalog?.();
    if (variant === "drawer") handleClose();
  };

  const captureEmailInBackground = (email: string) => {
    if (!isWorkEmail(email)) return;
    void startStoreBuyerAuth(email).then((result) => {
      if (result.sessionPresent) {
        setAuthHint("Portal session found — checkout can use this identity.");
      } else if (result.captured) {
        setAuthHint("Work email saved. You can keep going — we will not bounce you to a login page.");
      }
    });
  };

  const finish = () => {
    const next = { ...answers, workEmail: answers.workEmail.trim().toLowerCase() };
    markGuidedCompleted(next);
    captureEmailInBackground(next.workEmail);
    const rec = buildGuidedRecommendation(next);
    onComplete?.(rec, next);
    if (variant === "drawer") {
      handleClose();
    }
  };

  const body = (
    <div className={variant === "inline" ? "flex h-full min-h-0 flex-col" : "flex h-full flex-col"}>
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-de-accent/30 bg-de-accent/15">
            <Sparkles className="h-5 w-5 text-de-accent-ink" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-de-accent-ink">
              Guided store
            </p>
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              Three questions. Then a recommended set.
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Not a catalog dump. Not a login wall.
            </p>
          </div>
        </div>
        {variant === "drawer" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white/60 hover:bg-white/5 hover:text-white"
            data-testid="button-close-guided"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="border-b border-white/10 px-5 py-3 sm:px-6">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-de-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-white/55">
          Slide {step + 1} of {SLIDE_COUNT}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-6">
        {step === 0 && (
          <fieldset>
            <legend className="mb-4 text-2xl font-semibold text-white">Who are you?</legend>
            <div className="space-y-3">
              {GUIDED_BUYER_OPTIONS.map((opt) => {
                const selected = answers.buyerType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, buyerType: opt.value }))}
                    className={`flex min-h-16 w-full flex-col rounded-xl border px-4 py-4 text-left transition-colors ${
                      selected
                        ? "border-de-accent/50 bg-de-accent/15 text-white"
                        : "border-white/10 bg-[#141414] text-white/80 hover:border-white/20 hover:bg-[#171717]"
                    }`}
                    data-testid={`guided-option-buyerType-${opt.value}`}
                  >
                    <span className="text-base font-semibold">{opt.label}</span>
                    <span className="mt-1 text-sm text-white/50">{opt.blurb}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="mb-4 text-2xl font-semibold text-white">What are you trying to do?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {GUIDED_OBJECTIVE_OPTIONS.map((opt) => {
                const selected = answers.objective === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, objective: opt.value }))}
                    className={`flex min-h-16 w-full flex-col rounded-xl border px-4 py-4 text-left transition-colors ${
                      selected
                        ? "border-de-accent/50 bg-de-accent/15 text-white"
                        : "border-white/10 bg-[#141414] text-white/80 hover:border-white/20 hover:bg-[#171717]"
                    }`}
                    data-testid={`guided-option-objective-${opt.value}`}
                  >
                    <span className="text-base font-semibold">{opt.label}</span>
                    <span className="mt-1 text-sm text-white/50">{opt.blurb}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <div>
            <h3 className="mb-4 text-2xl font-semibold text-white">Scale and work email</h3>
            <p className="mb-5 text-sm text-white/55">
              People and sites size the recommendation. Work email starts identity in the background —
              slides do not wait on a portal login page.
            </p>
            <p className="mb-2 text-sm font-medium text-white/70">People</p>
            <div className="mb-5 grid grid-cols-2 gap-2">
              {GUIDED_SIZE_OPTIONS.map((opt) => {
                const selected = answers.companySize === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, companySize: opt.value }))}
                    className={`min-h-12 rounded-xl border px-3 py-3 text-sm font-medium ${
                      selected
                        ? "border-de-accent/50 bg-de-accent/15 text-white"
                        : "border-white/10 bg-[#141414] text-white/75 hover:border-white/20"
                    }`}
                    data-testid={`guided-option-companySize-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mb-2 text-sm font-medium text-white/70">Sites</p>
            <div className="mb-5 grid grid-cols-3 gap-2">
              {GUIDED_LOCATION_OPTIONS.map((opt) => {
                const selected = answers.locations === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, locations: opt.value }))}
                    className={`min-h-12 rounded-xl border px-3 py-3 text-sm font-medium ${
                      selected
                        ? "border-de-accent/50 bg-de-accent/15 text-white"
                        : "border-white/10 bg-[#141414] text-white/75 hover:border-white/20"
                    }`}
                    data-testid={`guided-option-locations-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <label htmlFor="guided-work-email" className="mb-2 block text-sm font-medium text-white/70">
              Work email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                id="guided-work-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@company.com"
                value={answers.workEmail}
                onChange={(event) => {
                  const workEmail = event.target.value;
                  setAnswers((prev) => ({ ...prev, workEmail }));
                }}
                onBlur={() => captureEmailInBackground(answers.workEmail)}
                className="h-12 border-white/15 bg-[#141414] pl-10 text-white placeholder:text-white/35"
                data-testid="guided-work-email"
              />
            </div>
            {signedInEmail ? (
              <p className="mt-2 text-sm text-de-accent-ink">
                Signed in as {signedInEmail}. We will attach this recommendation to that session.
              </p>
            ) : authHint ? (
              <p className="mt-2 text-sm text-white/55">{authHint}</p>
            ) : (
              <p className="mt-2 text-sm text-white/55">
                Used to continue checkout later. We do not invent a new store role here.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-white/10 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="h-12 border-white/15 bg-transparent text-white hover:bg-white/5 sm:w-auto"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            data-testid="button-guided-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            className="h-12 w-full flex-1 bg-de-accent text-white hover:bg-[#6548ff]"
            disabled={step === 2 && !emailReady}
            onClick={() => {
              if (step < SLIDE_COUNT - 1) {
                if (step === 1 && emailReady) captureEmailInBackground(answers.workEmail);
                setStep((current) => current + 1);
                return;
              }
              finish();
            }}
            data-testid="button-guided-next"
          >
            {step >= SLIDE_COUNT - 1 ? "See recommended set" : "Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="text-center">
          <SkipCatalogLink onClick={handleSkip} />
        </div>
        {variant === "drawer" && recommendation.products.length > 0 && step === 2 && (
          <p className="text-center text-xs text-white/40">
            Finishing adds {recommendation.products.length} recommended catalog items to Your Solution.
          </p>
        )}
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <section
        className="overflow-hidden rounded-2xl border border-white/10 bg-[#141414]"
        data-testid="guided-buying-wizard"
      >
        {body}
      </section>
    );
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm"
            onClick={handleClose}
            data-testid="guided-buying-overlay"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-[71] flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-[#0a0a0a]"
            data-testid="guided-buying-wizard"
          >
            {body}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
