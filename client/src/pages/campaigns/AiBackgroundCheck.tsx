import { useState } from "react";
import { Link } from "wouter";
import { MegaMenu } from "@/components/MegaMenu";
import { Container } from "@/components/site/chapters";
import { useSEO } from "@/hooks/useSEO";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { EXPOSURE_QUESTIONS, scoreExposure, type Answer } from "./aiBackgroundCheckQuiz";
import "./ai-background-check.css";

/**
 * /go/ai-background-check: concept B ("Personnel File") from PR #575, picked by
 * Joe on 2026-10-15. Copy is the claim-checked COPY.md wording (Intelligence
 * Hub, docs/projects/12-business-ai-messaging). Every CTA goes to the existing
 * /book flow. Joe, 2026-10-16: "do what will convert the best to a paid
 * client", so the offer terms are on the page: free, 30 minutes, screen share
 * with no passwords or admin access (logged in docs/CLAIMS-REGISTER.md).
 */

const BOOK_LABEL = "Book your free AI Background Check";

/** The offer terms, shown under the hero CTA and in the sign-off. */
const OFFER_TERMS = ["Free", "30 minutes", "Screen share: no passwords, no admin access"];

function OfferTerms() {
  return (
    <ul className="abc-terms" aria-label="What the check involves">
      {OFFER_TERMS.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

const OWNERSHIP_ROWS: { question: string; personal: string; business: string }[] = [
  { question: "Who owns the chats", personal: "The employee", business: "Your company" },
  {
    question: "Model training",
    personal: "May be used unless someone changes the settings",
    business: "Kept out by default, under business terms",
  },
  {
    question: "When they leave",
    personal: "Stays in the personal account, where your company can't reach it",
    business: "Your company can end access that day",
  },
  { question: "Audit trail", personal: "None for your company", business: "On plans that include it" },
];

const HIRING_STEPS: { title: string; body: string }[] = [
  {
    title: "Interview",
    body: "We help you pick the AI that fits your work and your budget. Sometimes that's the one that came with your software. Sometimes it isn't.",
  },
  {
    title: "Paperwork",
    body: "Business accounts, business terms that keep your data out of model training by default, and a one-page policy your team will actually read.",
  },
  {
    title: "Keys",
    body: "AI built into your work apps can reach anything the person using it can open. We clean up who can see what before AI gets access, and stop sensitive data from being pasted where it shouldn't go.",
  },
  {
    title: "Exit",
    body: "When someone leaves, their AI access goes too. You keep the history and, on plans that include it, the audit trail.",
  },
];

const REGULATED: { title: string; body: string }[] = [
  {
    title: "Healthcare",
    body: "Patient information in the wrong AI tool can be a HIPAA problem. Any AI tool that handles patient information needs a signed business associate agreement (BAA), and only some business plans offer one.",
  },
  {
    title: "Finance and insurance",
    body: "GLBA and the FTC Safeguards Rule set how you protect client financial data and oversee the vendors who handle it, AI included.",
  },
  {
    title: "Defense contractors",
    body: "Controlled unclassified information (CUI) has no place in consumer AI. CMMC assessors will ask.",
  },
];

const DELIVERABLES = [
  "Which AI tools are connected to your company data",
  "What they can reach",
  "Your top 3 fixes",
];

function BookLink({ testId }: { testId: string }) {
  return (
    <Link href="/book" className="abc-btn" data-testid={testId}>
      {BOOK_LABEL} <span aria-hidden="true">&rarr;</span>
    </Link>
  );
}

function SectionSide({ no, label }: { no: number; label: string }) {
  return (
    <div className="abc-side">
      <span className="abc-no">Section {no}</span>
      <h2 className="abc-side-label">{label}</h2>
    </div>
  );
}

function ExposureCheck() {
  const [answers, setAnswers] = useState<Partial<Record<string, Answer>>>({});
  const result = scoreExposure(answers);

  return (
    <>
      <form className="abc-form" aria-label="AI exposure self-check" onSubmit={(e) => e.preventDefault()}>
        {EXPOSURE_QUESTIONS.map((q) => (
          <fieldset key={q.id} className="abc-q">
            <legend>{q.prompt}</legend>
            <div className="abc-opt">
              {(["yes", "no"] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={q.id}
                    value={value}
                    checked={answers[q.id] === value}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
                    data-testid={`abc-quiz-${q.id}-${value}`}
                  />
                  <span>{value === "yes" ? "Yes" : "No"}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </form>
      <div className="abc-result" aria-live="polite" data-testid="abc-quiz-result">
        {result ? (
          <>
            <span className="abc-label">Illustrative exposure</span>
            <div className="abc-result-level">{result.level}</div>
            <p>{result.message}</p>
            <BookLink testId="abc-quiz-cta" />
          </>
        ) : null}
      </div>
    </>
  );
}

export default function AiBackgroundCheck() {
  useSEO({
    title: "Free AI Background Check",
    description:
      "A free 30-minute AI Background Check from Digerati Experts: which AI tools are connected to your company data, what they can reach, and your top 3 fixes. Screen share only; no passwords or admin access.",
    canonical: "/go/ai-background-check",
  });

  return (
    <div className="abc">
      <MegaMenu />
      <main id="main-content" tabIndex={-1}>
        <div className="abc-tab">
          <Container className="abc-tab-row">
            <span className="abc-label">Digerati Experts</span>
            <span className="abc-label">Personnel file &middot; AI Background Check</span>
          </Container>
        </div>

        <header className="abc-file">
          <Container>
            <div className="abc-fh" role="group" aria-label="Personnel file header">
              <div>
                <span className="abc-label">Employee</span>
                <span className="abc-v">A.I.</span>
              </div>
              <div>
                <span className="abc-label">Position</span>
                <span className="abc-v">New hire, every department</span>
              </div>
              <div>
                <span className="abc-label">References</span>
                <span className="abc-v abc-v--flag">Unchecked</span>
              </div>
              <div>
                <span className="abc-label">File status</span>
                <span className="abc-v abc-v--flag">Pending review</span>
              </div>
            </div>
            <h1>
              Your newest employee is <em>AI.</em> Did anyone check its references?
            </h1>
            <p className="abc-lede">
              Your team is already using AI to write emails, summarize contracts and crunch numbers. The question
              isn't whether to use AI. It's whose AI, and what it can see.
            </p>
            <div className="abc-cta-row">
              <BookLink testId="abc-hero-cta" />
              <OfferTerms />
            </div>
          </Container>
        </header>

        <Container>
          <section className="abc-sec" aria-labelledby="abc-owner">
            <SectionSide no={1} label="Who owns the account" />
            <div>
              <h3 className="abc-big" id="abc-owner">
                Personal AI works for the person. Business AI works for the business.
              </h3>
              <p className="abc-body">
                When someone uses AI on a personal account, the chats, the files and the history belong to that
                person, not your company. When they leave, it stays in their personal account, where your company
                can't reach it. Business AI is set up under your company: your company controls the data, decides
                who uses it, and can switch off access the day someone leaves.
              </p>
              <div className="abc-ledger">
                <table>
                  <caption className="sr-only">Personal account compared with business AI</caption>
                  <thead>
                    <tr>
                      <th scope="col">Question</th>
                      <th scope="col">Personal account</th>
                      <th scope="col">Business AI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {OWNERSHIP_ROWS.map((row) => (
                      <tr key={row.question}>
                        <th scope="row">{row.question}</th>
                        <td>{row.personal}</td>
                        <td>{row.business}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="abc-sec" aria-labelledby="abc-hire">
            <SectionSide no={2} label="Hiring record" />
            <div>
              <h3 className="abc-big" id="abc-hire">
                Hire your AI the right way.
              </h3>
              <ol className="abc-rec">
                {HIRING_STEPS.map((step, i) => (
                  <li key={step.title}>
                    <span className="abc-tick" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h4>{step.title}</h4>
                    <p>{step.body}</p>
                  </li>
                ))}
              </ol>
              <p className="abc-margin">
                <span className="abc-label">Margin note</span>
                Some AI shows up already hired, because it came bundled with your software. It still needs an
                interview.
              </p>
            </div>
          </section>

          <section className="abc-sec" aria-labelledby="abc-score">
            <SectionSide no={3} label="Intake form" />
            <div>
              <h3 className="abc-big" id="abc-score">
                What's your AI exposure?
              </h3>
              <p className="abc-body">Four questions, about 20 seconds. An illustrative self-check, not an assessment.</p>
              <ExposureCheck />
            </div>
          </section>

          <section className="abc-sec" aria-labelledby="abc-regulated">
            <SectionSide no={4} label="Regulatory flags" />
            <div>
              <h3 className="abc-big" id="abc-regulated">
                Already regulated? This matters more.
              </h3>
              <ul className="abc-reg">
                {REGULATED.map((item) => (
                  <li key={item.title}>
                    <h4>{item.title}</h4>
                    <p>{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </Container>

        <section className="abc-sign" aria-labelledby="abc-sign">
          <Container className="abc-sign-grid">
            <div>
              <span className="abc-label abc-label--accent">Sign-off</span>
              <h2 id="abc-sign">Book your free AI Background Check.</h2>
              <p className="abc-sign-lede">
                In 30 minutes, we'll show you which AI tools are connected to your company data, what they can reach,
                and your top 3 fixes. You share your screen and we look together; we never ask for passwords or admin
                access.
              </p>
              <p className="abc-sign-next">
                What happens next is your call. Keep the fixes and do them yourself, or have DE do them for you.
              </p>
            </div>
            <div>
              <ul>
                {DELIVERABLES.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <BookLink testId="abc-closing-cta" />
              <OfferTerms />
            </div>
          </Container>
        </section>
      </main>
      <DigeratiEnhancedFooterSection />
    </div>
  );
}
