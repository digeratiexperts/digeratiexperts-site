import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, Copy, Laptop, Lock, ShieldCheck, Sparkles, X } from "lucide-react";
import { ScratchCard, type ScratchCardHandle } from "./ScratchCard";
import { SparkleBurst } from "./SparkleBurst";
import { bookingHrefForClaim, type ScratchState, type ScratchStep } from "@/lib/scratchOffer";
import {
  SCRATCH_OFFER_TAG,
  SCRATCH_OFFER_TERMS as T,
  US_STATES,
  isExcludedState,
  normalizeClaimCode,
  validateClaimFields,
  type ClaimFieldErrors,
} from "@shared/scratchOffer";
import { CARD_DATA_REJECTED_CODE, CARD_DATA_REJECTED_MESSAGE, looksLikeCardData } from "@shared/pciGuard";

const FINE_PRINT = T.showCreditTerms ? `${T.finePrint} ${T.creditTerms}` : T.finePrint;
const PRIVACY_HREF = "/legal/privacy-policy";

type Props = {
  state: ScratchState;
  onChange: (next: ScratchState) => void;
  onClose: () => void;
  reducedMotion: boolean;
};

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

function Band({ children, id }: { children: string; id: string }) {
  return (
    <div className="relative -mx-5 overflow-hidden bg-gradient-to-r from-[#D3126A] via-[#e0247c] to-[#5B45E0] px-5 py-6 sm:-mx-8 sm:px-8">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.35),transparent_55%)]" />
      <h2 id={id} tabIndex={-1} className="relative font-heading text-[1.9rem] font-black uppercase leading-[0.95] tracking-tight text-white outline-none sm:text-[2.2rem]">
        {children}
      </h2>
    </div>
  );
}

export function ScratchOfferModal({ state, onChange, onClose, reducedMotion }: Props) {
  const titleId = useId();
  const descId = useId();
  const emailId = useId();
  const companyId = useId();
  const stateId = useId();
  const optInId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<ScratchCardHandle>(null);
  const headingRef = useRef<HTMLElement | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLSelectElement>(null);
  const [announce, setAnnounce] = useState("");
  const [burst, setBurst] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [usState, setUsState] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<ClaimFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const step: ScratchStep = state.step;
  const revealed = step !== "scratch";

  const go = useCallback((next: Partial<ScratchState>) => onChange({ ...state, ...next, open: true }), [onChange, state]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>(`[data-step-heading="${step}"]`) ??
        dialogRef.current?.querySelector<HTMLElement>("h2[tabindex]");
      (target ?? headingRef.current)?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [step]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      document.body.style.overflow = previous;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]):not([tabindex="-1"]), [tabindex="0"]',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleReveal = useCallback(() => {
    if (state.step !== "scratch") return;
    vibrate([14, 40, 22]);
    if (!reducedMotion) setBurst(true);
    setAnnounce(`Revealed: ${T.revealTitle}, ${T.revealTag.toLowerCase()}.`);
    go({ step: "revealed" });
  }, [go, reducedMotion, state.step]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const nextErrors = validateClaimFields({ email, company, state: usState });
    if (!nextErrors.company && looksLikeCardData(company)) nextErrors.company = CARD_DATA_REJECTED_MESSAGE;
    setErrors(nextErrors);
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.company) {
      companyRef.current?.focus();
      return;
    }
    if (nextErrors.state) {
      stateRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          offer: SCRATCH_OFFER_TAG,
          email: email.trim(),
          company: company.trim(),
          state: usState,
          marketingOptIn: optIn,
          website_url: honeypot,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        claimCode?: string;
        code?: string;
        fields?: ClaimFieldErrors;
      };
      if (body.code === CARD_DATA_REJECTED_CODE) {
        setErrors({ company: CARD_DATA_REJECTED_MESSAGE });
        companyRef.current?.focus();
        return;
      }
      if (body.code === "state_excluded") {
        setErrors({ state: T.excludedStateMessage });
        stateRef.current?.focus();
        return;
      }
      if (body.fields && Object.keys(body.fields).length) {
        setErrors(body.fields);
        return;
      }
      const code = normalizeClaimCode(body.claimCode);
      if (!res.ok || !code) throw new Error("claim failed");
      setAnnounce(`Your claim code is ${code.split("").join(" ")}.`);
      go({ step: "code", claimCode: code });
    } catch {
      setSubmitError("We couldn't save that. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!state.claimCode) return;
    const ok = await copyText(state.claimCode);
    setCopied(ok);
    setAnnounce(ok ? "Claim code copied." : "Couldn't copy. Select the code and copy it.");
    vibrate(8);
    if (ok) window.setTimeout(() => setCopied(false), 2200);
  };

  const fieldClass = (invalid: boolean) =>
    `mt-1.5 block w-full rounded-xl border bg-white/[0.04] px-4 py-3.5 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#F04C97] ${
      invalid ? "border-rose-400" : "border-white/15"
    }`;

  return (
    <div className="fixed inset-0 z-[10060] flex items-stretch justify-center sm:items-center sm:p-6" data-testid="scratch-offer">
      <div aria-hidden="true" className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative flex h-full w-full flex-col overflow-y-auto overscroll-contain bg-black text-white sm:h-auto sm:max-h-[92vh] sm:max-w-[30rem] sm:rounded-3xl sm:ring-1 sm:ring-white/10"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#D3126A]/35 blur-[90px]" />
          <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-[#5B45E0]/35 blur-[90px]" />
          <div className="absolute inset-0 [background-image:var(--de-field-grain)]" />
        </div>

        <div className="sticky top-0 z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close offer"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F04C97]"
            data-testid="scratch-close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Digerati Experts</span>
          <span className="w-11" aria-hidden="true" />
        </div>

        <div className={`relative z-10 flex flex-1 flex-col ${step === "scratch" || step === "revealed" ? "select-none" : ""} px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:px-8 sm:pb-8`}>
          <p id={descId} className="sr-only">
            Every business gets the same offer: a {T.revealTitle}. {FINE_PRINT}
          </p>

          {step === "scratch" || step === "revealed" ? (
            <>
              <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#F04C97]/40 bg-[#D3126A]/15 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#F04C97]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {T.eyebrow}
              </p>
              <h2
                id={titleId}
                data-step-heading={step}
                tabIndex={-1}
                className="mt-3 font-heading text-[2.6rem] font-black uppercase leading-[0.9] tracking-tight outline-none sm:text-[2.9rem]"
              >
                {revealed ? (
                  T.revealedHeadline
                ) : (
                  <>
                    {T.headline}{" "}
                    <span className="bg-gradient-to-r from-[#F04C97] via-[#f6d77b] to-[#8b7bff] bg-clip-text text-transparent">{T.headlineAccent}</span>
                  </>
                )}
              </h2>
              <p className="mt-3 text-[15px] leading-snug text-white/75">
                {revealed ? T.summary : T.subhead}
              </p>

              <div className="relative mt-7">
                <div aria-hidden="true" className={`absolute -left-3 -top-5 z-20 grid h-14 w-14 rotate-[-10deg] place-items-center rounded-2xl bg-gradient-to-br from-[#D3126A] to-[#7a0b3e] shadow-[0_10px_30px_-6px_rgba(211,18,106,0.8)] ring-1 ring-white/20 ${reducedMotion ? "" : "de-scratch-float"}`}>
                  <ShieldCheck className="h-7 w-7 text-white" />
                </div>
                <div aria-hidden="true" className={`absolute -bottom-5 -right-2 z-20 grid h-14 w-14 rotate-[8deg] place-items-center rounded-2xl bg-gradient-to-br from-[#5B45E0] to-[#2a1d7a] shadow-[0_10px_30px_-6px_rgba(91,69,224,0.8)] ring-1 ring-white/20 ${reducedMotion ? "" : "de-scratch-float de-scratch-float-late"}`}>
                  <Laptop className="h-7 w-7 text-white" />
                </div>
                <ScratchCard
                  ref={cardRef}
                  revealed={revealed}
                  reducedMotion={reducedMotion}
                  onFirstScratch={() => vibrate(8)}
                  onReveal={handleReveal}
                  label="Scratch-off card. Scratch with your finger or mouse, or use the Reveal without scratching button."
                >
                  <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#3a0c26,#07040c_72%)] px-4 text-center">
                    <ShieldCheck aria-hidden="true" className="absolute -right-6 -top-6 h-40 w-40 text-[#D3126A]/10" strokeWidth={1.2} />
                    <div aria-hidden="true" className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-[#f6d77b]/70 to-transparent" />
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#f6d77b]">{T.revealKicker}</p>
                    <p className="mt-1 bg-gradient-to-b from-white to-[#F04C97] bg-clip-text font-heading text-[3.4rem] font-black uppercase leading-none text-transparent">
                      {T.revealTitle.split(" ")[0]}
                    </p>
                    <p className="font-heading text-xl font-bold uppercase tracking-wide text-white">
                      {T.revealTitle.split(" ").slice(1).join(" ")}
                    </p>
                    <p className="mt-2 rounded-full bg-[#f6d77b] px-3 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-black">
                      {T.revealTag}
                    </p>
                  </div>
                </ScratchCard>
              </div>

              <div className="mt-9 flex flex-col gap-3">
                {revealed ? (
                  <>
                    <button
                      type="button"
                      onClick={() => go({ step: "details" })}
                      className="w-full rounded-full bg-[#D3126A] px-6 py-4 font-heading text-lg font-bold text-white shadow-[0_14px_40px_-12px_rgba(211,18,106,0.9)] transition hover:bg-[#e01874] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      data-testid="scratch-claim"
                    >
                      {T.claimCta}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full rounded-full px-6 py-3 text-sm font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F04C97]"
                    >
                      Maybe later
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => cardRef.current?.revealAll()}
                    className="w-full rounded-full border border-white/25 px-6 py-3.5 text-[15px] font-semibold text-white transition hover:border-white/50 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F04C97]"
                    data-testid="scratch-reveal"
                  >
                    Reveal without scratching
                  </button>
                )}
              </div>
              <p className="mt-5 text-[11px] leading-relaxed text-white/50">{FINE_PRINT}</p>
            </>
          ) : null}

          {step === "details" ? (
            <form onSubmit={submit} noValidate className="flex flex-col">
              <Band id={titleId}>{T.detailsBand}</Band>
              <p className="mt-6 font-heading text-xl font-semibold leading-snug">{T.detailsQuestion}</p>

              <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="website_url" />
                </label>
              </div>

              <label htmlFor={emailId} className="mt-5 text-sm font-semibold text-white">
                Work email
              </label>
              <input
                ref={emailRef}
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? `${emailId}-err` : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="you@yourcompany.com"
                className={fieldClass(!!errors.email)}
                data-testid="scratch-email"
              />
              {errors.email ? (
                <p id={`${emailId}-err`} className="mt-1.5 text-sm font-medium text-rose-300">
                  {errors.email}
                </p>
              ) : null}

              <label htmlFor={companyId} className="mt-4 text-sm font-semibold text-white">
                Business name
              </label>
              <input
                ref={companyRef}
                id={companyId}
                type="text"
                autoComplete="organization"
                required
                aria-required="true"
                maxLength={120}
                aria-invalid={!!errors.company}
                aria-describedby={errors.company ? `${companyId}-err` : undefined}
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  if (errors.company) setErrors((prev) => ({ ...prev, company: undefined }));
                }}
                placeholder="Your business"
                className={fieldClass(!!errors.company)}
                data-testid="scratch-company"
              />
              {errors.company ? (
                <p id={`${companyId}-err`} className="mt-1.5 text-sm font-medium text-rose-300">
                  {errors.company}
                </p>
              ) : null}

              <label htmlFor={stateId} className="mt-4 text-sm font-semibold text-white">
                Business state
              </label>
              <select
                ref={stateRef}
                id={stateId}
                required
                aria-required="true"
                autoComplete="address-level1"
                aria-invalid={!!errors.state}
                aria-describedby={errors.state ? `${stateId}-err` : undefined}
                value={usState}
                onChange={(e) => {
                  const next = e.target.value;
                  setUsState(next);
                  setErrors((prev) => ({
                    ...prev,
                    state: isExcludedState(next) ? T.excludedStateMessage : undefined,
                  }));
                }}
                className={`${fieldClass(!!errors.state)} appearance-none bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat`}
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
                data-testid="scratch-state"
              >
                <option value="" className="bg-black">Choose a state</option>
                {US_STATES.map(([code, name]) => (
                  <option key={code} value={code} className="bg-black">
                    {name}
                  </option>
                ))}
              </select>
              {errors.state ? (
                <p id={`${stateId}-err`} className="mt-1.5 text-sm font-medium text-rose-300" data-testid="scratch-state-error">
                  {errors.state}
                  {isExcludedState(usState) ? (
                    <>
                      {" "}
                      <a href="/contact" className="font-semibold text-white underline underline-offset-2 hover:text-[#F04C97]">
                        Contact us
                      </a>{" "}
                      to talk about other options.
                    </>
                  ) : null}
                </p>
              ) : null}

              <div className="mt-5 flex items-start gap-3">
                <input
                  id={optInId}
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/30 bg-transparent accent-[#D3126A]"
                />
                <label htmlFor={optInId} className="text-sm leading-snug text-white/75">
                  Optional: also email me occasional security tips and offers from Digerati Experts.
                </label>
              </div>

              {submitError ? (
                <p role="alert" className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {submitError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting || isExcludedState(usState)}
                className="mt-6 w-full rounded-full bg-[#D3126A] px-6 py-4 font-heading text-lg font-bold text-white shadow-[0_14px_40px_-12px_rgba(211,18,106,0.9)] transition hover:bg-[#e01874] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-60"
                data-testid="scratch-continue"
              >
                {submitting ? "Saving…" : "Continue"}
              </button>
              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-white/55">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  We use this to set up your Security Snapshot. See our{" "}
                  <a href={PRIVACY_HREF} className="font-semibold text-white underline underline-offset-2 hover:text-[#F04C97]">
                    Privacy Notice
                  </a>
                  .
                </span>
              </p>
            </form>
          ) : null}

          {step === "code" && state.claimCode ? (
            <div className="flex flex-col">
              <Band id={titleId}>{T.codeBand}</Band>
              <p className="mt-7 text-center font-heading text-lg font-semibold">{T.codeIntro}</p>
              <div className="relative mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={copyCode}
                  className="group flex items-center gap-3 rounded-full border-2 border-dashed border-[#f6d77b] bg-[#f6d77b]/10 px-6 py-4 font-mono text-[1.45rem] font-bold tracking-[0.12em] text-[#f6d77b] transition hover:bg-[#f6d77b]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label={`Claim code ${state.claimCode}. Tap to copy.`}
                  data-testid="scratch-code"
                >
                  <span>{state.claimCode}</span>
                  {copied ? <Check className="h-5 w-5" aria-hidden="true" /> : <Copy className="h-5 w-5 opacity-80" aria-hidden="true" />}
                </button>
              </div>
              <p className="mt-3 flex h-6 items-center justify-center text-xs text-white/55" aria-hidden="true">
                {copied ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-bold text-black shadow-lg">
                    <Check className="h-3.5 w-3.5" /> Copied
                  </span>
                ) : (
                  "Tap the code to copy it."
                )}
              </p>
              <p className="mt-5 text-center text-sm text-white/70">{T.codeNote}</p>
              <a
                href={bookingHrefForClaim(state.claimCode)}
                className="mt-7 block w-full rounded-full bg-[#D3126A] px-6 py-4 text-center font-heading text-lg font-bold text-white shadow-[0_14px_40px_-12px_rgba(211,18,106,0.9)] transition hover:bg-[#e01874] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                data-testid="scratch-book"
              >
                {T.bookCta}
              </a>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full rounded-full px-6 py-3 text-sm font-semibold text-white/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F04C97]"
              >
                Done
              </button>
              <p className="mt-5 text-[11px] leading-relaxed text-white/50">{FINE_PRINT}</p>
            </div>
          ) : null}
        </div>

        {burst ? <SparkleBurst onDone={() => setBurst(false)} /> : null}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announce}
        </p>
      </div>
    </div>
  );
}
