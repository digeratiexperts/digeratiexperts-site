import { useState, type KeyboardEvent } from "react";
import { CheckIcon } from "../icons";

const BLOCKS = [
  {
    key: "Identity & access",
    answers: "Answers credential theft",
    detail: "Control who can access business systems, how access is verified, and how accounts are changed or removed over time.",
    questions: ["Is MFA appropriate and enforced where required?", "Are privileged accounts separated and reviewed?", "Does offboarding remove access consistently?"],
  },
  {
    key: "Endpoint",
    answers: "Answers malware",
    detail: "Keep managed devices visible, maintained, and protected with controls matched to device ownership, user role, and business risk.",
    questions: ["Which devices are actually in scope?", "Are security and patch states visible?", "What happens when a device needs containment or rebuild?"],
  },
  {
    key: "Email & collaboration",
    answers: "Answers phishing",
    detail: "Reduce email-driven risk while keeping authentication, filtering, user behavior, and account settings understandable and supportable.",
    questions: ["Are domain-authentication records configured correctly?", "Are risky mailbox rules or forwarding visible?", "How are users trained and supported after suspicious messages?"],
  },
  {
    key: "Browser & web",
    answers: "Answers web-borne compromise",
    detail: "Reduce web-borne risk on managed devices: filtering, browser policy, and safe access to the SaaS the business actually runs on.",
    questions: ["Is web or DNS filtering enforced on managed devices?", "Which browser settings and extensions are controlled?", "How is business SaaS access separated from personal browsing?"],
  },
  {
    key: "Network",
    answers: "Answers lateral movement",
    detail: "Document and manage the business network so internet edge, switching, Wi-Fi, segmentation, and remote access match the operating model.",
    questions: ["Who owns and administers the network equipment?", "Are guest, IoT, and business networks separated appropriately?", "Is the configuration documented and recoverable?"],
  },
  {
    key: "Detection & response",
    answers: "Answers persistence",
    detail: "Watch the environment continuously and act on what matters: detection, triage, containment, and escalation through a documented path.",
    questions: ["Who is watching, and around the clock?", "What is the containment authority and the escalation path?", "Are detections tuned to this environment or generic?"],
  },
  {
    key: "Human risk",
    answers: "Answers social engineering",
    detail: "Make people a managed control: awareness, simulation, and a reporting path that fit the organization rather than a checkbox.",
    questions: ["Do users know how to report a suspicious message?", "Is training matched to role and risk?", "Are results used to adjust controls, not to assign blame?"],
  },
  {
    key: "Risk & exposure",
    answers: "Runs continuously under all seven",
    detail: "The visibility layer beneath the other seven: what is exposed, what is unpatched, what changed, and what that means for the business.",
    questions: ["What is exposed to the internet right now?", "Which findings are open, and who owns them?", "How is risk reported in business terms?"],
    continuous: true,
  },
];

/** "What we protect": eight blocks behind a tab list. Arrow keys move between tabs (WAI-ARIA tabs pattern). */
export function ProtectionSection(): JSX.Element {
  const [active, setActive] = useState(0);
  const block = BLOCKS[active];

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = BLOCKS.length;
    let next: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % count;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index - 1 + count) % count;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    document.getElementById(`protect-tab-${next}`)?.focus();
  };

  return (
    <section className="sec t-ink" id="protection">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">What we protect</p>
            <h2>Eight blocks. One accountable operating model.</h2>
          </div>
          <p className="lede">Each block answers a specific class of threat. Risk and exposure runs continuously beneath the other seven.</p>
        </div>
        <div className="card deep model">
          <div className="tabs" role="tablist" aria-label="Protection blocks">
            {BLOCKS.map((item, index) => (
              <button
                key={item.key}
                id={`protect-tab-${index}`}
                type="button"
                role="tab"
                className={`tab${item.continuous ? " cont" : ""}`}
                aria-selected={index === active}
                aria-controls="protect-panel"
                tabIndex={index === active ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                <b>{item.key}</b>
                <small>{item.answers}</small>
              </button>
            ))}
          </div>
          <div className="panel" role="tabpanel" id="protect-panel" aria-labelledby={`protect-tab-${active}`} aria-live="polite">
            <span className="chip">{block.answers}</span>
            <h3>{block.key}</h3>
            <p>{block.detail}</p>
            <div className="qh">Questions the assessment should answer</div>
            <ul className="qs">
              {block.questions.map((question) => (
                <li key={question}><CheckIcon /><span>{question}</span></li>
              ))}
            </ul>
          </div>
        </div>
        <p className="note">Illustrative model. Scope, controls, monitoring, and vendors depend on the operating model and your environment.</p>
      </div>
    </section>
  );
}
