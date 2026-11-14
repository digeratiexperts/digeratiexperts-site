import "./homepage-b3.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { MegaMenu } from "@/components/MegaMenu";
import { useSEO } from "@/hooks/useSEO";
import TurnstileWidget from "@/components/TurnstileWidget";
import { openMspAdvisor } from "@/lib/openMspAdvisor";
import { readSituationSessionId, writeSituationSessionId } from "@/lib/situationDeskSession";
import { SiteFooter } from "../homepage-v2/sections/SiteFooter";
import "../homepage-v2/homepage-v2.css";
import {
  FIT_CALL_URL,
  PAGE_SERVICES,
  PROFILE_DRAFT_CONSENT_TEXT,
  PROFILE_DRAFT_CONSENT_VERSION,
  SITUATION_TEXT_MAX,
  localMatch,
  matchFromScenario,
  planText,
  scenarioById,
  type SituationMatch,
} from "@shared/situationMatch";
import { saveProfileClaim } from "@/lib/profileClaim";
import { PRE_CHAT_CONSENT_REQUIRED_MESSAGE } from "@shared/preChatConsent";
import { deskMatch, isDeskMatchErr, SITUATION_MATCH_AI_DISCLOSURE } from "./describeSituationMatch";

type Shown = { r: SituationMatch; text: string; how: "typed" | "picked"; draftEnabled: boolean } | { more: true } | null;

/** /describe-your-situation: the custom card's page. DE Desk acting as the sales desk. */
export default function DescribeSituation(): JSX.Element {
  useSEO({
    title: "Describe your situation | Digerati Experts",
    description: "Say it in your words. DE Desk finds the closest situation, and what Digerati Experts would look at.",
    canonical: "/describe-your-situation",
  });
  const [text, setText] = useState("");
  const [shown, setShown] = useState<Shown>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [tsKey, setTsKey] = useState(0);
  const [matchConsent, setMatchConsent] = useState(false);
  const [matchError, setMatchError] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("s") || "";
    const m = id ? matchFromScenario(id) : null;
    if (m) setShown({ r: m, text: scenarioById(id)!.title, how: "picked", draftEnabled: false });
  }, []);

  const fresh = () => {
    setToken("");
    setTsKey((k) => k + 1);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (t.replace(/[^a-z]/gi, "").length < 4) {
      setShown({ more: true });
      return;
    }
    if (!matchConsent) {
      setMatchError(PRE_CHAT_CONSENT_REQUIRED_MESSAGE);
      return;
    }
    setMatchError("");
    setBusy(true);
    const got = token
      ? await deskMatch(t, { turnstileToken: token, sessionId: readSituationSessionId() })
      : { match: localMatch(t), sessionId: undefined, draftEnabled: false };
    if (token) fresh();
    if (isDeskMatchErr(got)) {
      setBusy(false);
      setMatchError(got.error.message);
      return;
    }
    if (got.sessionId) writeSituationSessionId(got.sessionId);
    setBusy(false);
    setShown(got.match.confident ? { r: got.match, text: t, how: "typed", draftEnabled: got.draftEnabled } : { more: true });
  }

  return (
    <>
      <MegaMenu />
      <div className="b3 describe-page">
        <main id="main">
          <section className="describe-hero dark" aria-labelledby="desc-h">
            <div className="wrap">
              <p className="kicker">Where you are now</p>
              <h1 id="desc-h">Describe your situation.</h1>
              <p className="lede">Say it in your words. DE Desk finds the closest situation on this site, and what Digerati Experts would look at.</p>
              <Link className="textlink" href="/#situations">All situations</Link>
            </div>
          </section>

          <section className="describe light sheet" id="describe" aria-label="Describe your situation">
            <div className="wrap">
              <div className="own" id="sitOwn">
                <form className="own__form" onSubmit={onSubmit} noValidate>
                  <div className="own__top">
                    <label htmlFor="sitText" className="own__label">Tell us what&rsquo;s going on, in your words.</label>
                  </div>
                  <textarea
                    id="sitText"
                    ref={taRef}
                    rows={5}
                    maxLength={SITUATION_TEXT_MAX}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="e.g. Two people start Monday and we still don’t have laptops. Or: our insurer sent a security questionnaire and we don’t know the answers."
                    aria-describedby="sitHint sitAiNotice"
                  />
                  <p className="own__ex" id="sitHint">
                    <span>Try:</span>
                    {["Someone clicked a link in a fake invoice email", "We’re moving to a bigger office in March", "A client wants our HIPAA policies"].map((x) => (
                      <button key={x} type="button" className="sit__ex" onClick={() => { setText(x); taRef.current?.focus(); }}>
                        &ldquo;{x}&rdquo;
                      </button>
                    ))}
                  </p>
                  <div className="own__turnstile">
                    <TurnstileWidget key={tsKey} theme="light" onVerify={setToken} onError={() => setToken("")} />
                  </div>
                  <p className="own__ai-notice" id="sitAiNotice">{SITUATION_MATCH_AI_DISCLOSURE}</p>
                  {matchError ? <p className="own__match-error" role="alert">{matchError}</p> : null}
                  <div className="own__row">
                    {!matchConsent ? (
                      <button type="button" className="btn" onClick={() => { setMatchConsent(true); setMatchError(""); }}>
                        Agree and continue
                      </button>
                    ) : (
                      <button type="submit" className="btn" disabled={busy} aria-busy={busy}>
                        {busy ? "Matching\u2026" : "Smart match"}
                      </button>
                    )}
                  </div>
                </form>
                <div className="own__out" id="sitResult" aria-live="polite">
                  {shown === null && (
                    <div className="res res--wait">
                      <p className="res__k">Smart match</p>
                      <p className="res__read">Write a sentence or two, then match. We&rsquo;ll show the closest situations on the page, and what Digerati Experts would look at.</p>
                    </div>
                  )}
                  {shown && "more" in shown && (
                    <div className="res res--more">
                      <p className="res__read">
                        <b>Tell us a bit more.</b> A sentence or two about what&rsquo;s happening (who it affects, what broke or what&rsquo;s changing) is plenty. Or{" "}
                        <Link href="/#situations">pick a situation</Link>.
                      </p>
                    </div>
                  )}
                  {shown && "r" in shown && <MatchResult key={shown.text + shown.how} {...shown} sessionId={readSituationSessionId()} />}
                </div>
              </div>
            </div>
          </section>

          <section className="close close--compact dark sheet sheet--dark" aria-labelledby="close-h">
            <div className="wrap close__grid">
              <div className="close__copy">
                <h2 id="close-h">Thirty minutes. Then you&apos;ll&nbsp;know.</h2>
                <p className="lede">A Fit Call is a straight conversation about what you run today and whether DE should own it.</p>
                <a className="btn" href={FIT_CALL_URL} target="_blank" rel="noopener">
                  Book a Fit Call <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" /></svg>
                </a>
              </div>
            </div>
          </section>
        </main>
      </div>
      <div className="hv2">
        <SiteFooter />
      </div>
    </>
  );
}

function MatchResult({ r, text, how, draftEnabled, sessionId }: { r: SituationMatch; text: string; how: "typed" | "picked"; draftEnabled: boolean; sessionId?: string }): JSX.Element {
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<"" | "ok" | "fail">("");
  const [token, setToken] = useState("");
  const [tsKey, setTsKey] = useState(0);
  const summary = r.summary || (how === "picked" ? scenarioById(r.scenarioIds[0])?.pressure || "" : "");
  const seed = "From the site: " + text + (r.scenarioIds.length ? " (closest: " + scenarioById(r.scenarioIds[0])?.title + ")" : "");

  const copy = async () => {
    const txt = planText(r, text);
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      /* the plan is still on screen */
    }
    setNote("Copied. Paste it into an email to whoever signs off on IT.");
  };
  const saveDraft = async () => {
    if (!consent || !sessionId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public/advisor/situation-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ sessionId, consent: true, consentTextVersion: PROFILE_DRAFT_CONSENT_VERSION, turnstileToken: token }),
      });
      const j = res.ok ? await res.json() : null;
      if (j && saveProfileClaim(j)) setSaved("ok");
      else setSaved("fail");
    } catch {
      setSaved("fail");
    } finally {
      setSaving(false);
      setToken("");
      setTsKey((k) => k + 1);
    }
  };

  return (
    <div className="res">
      <p className="res__k">{how === "picked" ? "You picked" : "Smart match"}</p>
      {summary && <p className="res__read">{summary}</p>}
      {r.urgent && (
        <p className="res__urgent">
          <b>Happening right now?</b> Don&rsquo;t wait for a Fit Call. Open DE Desk and say so.
        </p>
      )}
      {how === "typed" && r.scenarioIds.length > 0 && (
        <div className="res__blk">
          <h4>Closest situation{r.scenarioIds.length > 1 ? "s" : ""}</h4>
          <ul className="res__cards">
            {r.scenarioIds.map((c) => (
              <li key={c}>
                <Link href={`/#sit-${c}`}>{scenarioById(c)?.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="res__blk">
        <h4>What Digerati&nbsp;Experts would look at</h4>
        <ul className="res__svc">
          {r.pageServiceIds.map((v) => {
            const s = PAGE_SERVICES[v];
            return (
              <li key={v}>
                <a
                  href={"/" + s.where}
                  onClick={() => {
                    if (s.card !== undefined) {
                      try {
                        sessionStorage.setItem("de-deck", String(s.card));
                      } catch {
                        /* the deck starts on card one */
                      }
                    }
                  }}
                >
                  <b>{s.name}</b>
                  <small>
                    {s.line} <em>{s.at}</em>
                  </small>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="res__blk">
        <h4>What happens next</h4>
        <ol className="res__next">
          <li><b>Fit Call.</b> 30 minutes on exactly this, and whether DE is the right fit.</li>
          <li><b>Assessment.</b> What you actually run, measured, not guessed.</li>
          <li><b>Your price, confirmed.</b> From the published floor for your level.</li>
        </ol>
      </div>
      <div className="res__acts">
        <a className="btn" href={FIT_CALL_URL} target="_blank" rel="noopener">
          Book a Fit Call <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" /></svg>
        </a>
        <button type="button" className="btn btn--ghost" onClick={() => openMspAdvisor({ seedMessage: seed, context: "home", tab: "chat", sessionId: sessionId || readSituationSessionId() })}>
          Keep talking with DE Desk
        </button>
        <button type="button" className="btn btn--ghost" onClick={copy}>
          Copy your IT plan
        </button>
      </div>
      {note && <p className="res__note">{note}</p>}
      {how === "typed" && draftEnabled && sessionId && saved !== "ok" && (
        <div className="res__blk">
          <h4>Start your IT &amp; Security Profile</h4>
          <label className="own__consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{PROFILE_DRAFT_CONSENT_TEXT}</span>
          </label>
          <div className="own__turnstile">
            <TurnstileWidget key={tsKey} theme="light" onVerify={setToken} onError={() => setToken("")} />
          </div>
          <div className="res__acts">
            <button type="button" className="btn btn--ghost" disabled={!consent || saving} onClick={saveDraft}>
              {saving ? "Saving\u2026" : "Save as a profile draft"}
            </button>
          </div>
          {saved === "fail" && <p className="res__saved">That didn&rsquo;t save. Your plan is still here, and DE Desk can pick it up.</p>}
        </div>
      )}
      {saved === "ok" && (
        <p className="res__saved">
          Saved as a draft. <Link href="/portal/signup">Create your portal account</Link> within 30 days and it becomes the start of your IT &amp; Security Profile.
        </p>
      )}
      <p className="res__src">
        {r.source === "de-desk"
          ? "Matched by DE Desk, using only what\u2019s on this site."
          : r.source === "card"
            ? "From the situation you picked."
            : "Matched in your browser, using only what\u2019s on this site."}
      </p>
    </div>
  );
}
