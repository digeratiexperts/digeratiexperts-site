import { useState, type MouseEvent } from "react";
import { Link } from "wouter";
import { PAGE_SERVICES, SCENARIOS, SCENARIO_PAGE_SERVICES } from "@shared/situationMatch";
import { SCENARIO_GROUPS, type ScenarioGroupId, type SolutionScenario } from "@/data/solutionScenarios";
import { openMspAdvisor } from "@/lib/openMspAdvisor";

export const DESCRIBE_PATH = "/describe-your-situation";

function GroupIcon({ id }: { id: ScenarioGroupId }): JSX.Element {
  if (id === "now") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 2 4 14h8l-1 8 9-12h-8l1-8z" />
      </svg>
    );
  }
  if (id === "change") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20V9" />
        <path d="m8 13 4-4 4 4" />
        <circle cx="12" cy="5.5" r="2" />
        <path d="M5 20h14" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 5 6.2v5.6c0 4.3 3 7.4 7 8.7 4-1.3 7-4.4 7-8.7V6.2L12 3z" />
      <path d="m8.8 12.1 2.2 2.2 4.3-4.5" />
    </svg>
  );
}

function finePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function SituationCard({
  s,
  open,
  onToggle,
}: {
  s: SolutionScenario;
  open: boolean;
  onToggle: () => void;
}): JSX.Element {
  const href = `${DESCRIBE_PATH}?s=${encodeURIComponent(s.id)}`;
  const detailId = `sit-d-${s.id}`;
  const onLinkClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (finePointer() || open) return;
    e.preventDefault();
    onToggle();
  };
  return (
    <li className={open ? "sit is-open" : "sit"} id={`sit-${s.id}`} data-g={s.group}>
      <div className="sit__face">
        <Link className="sit__t" href={href} onClick={onLinkClick}>
          {s.title}
        </Link>
        <button type="button" className="sit__more" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
          <span className="sr-only">{open ? "Hide details" : "Show details"}</span>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6.5 8 10.5 12 6.5" />
          </svg>
        </button>
      </div>
      <div className="sit__detail" id={detailId}>
        <div className="sit__detail-inner">
          <p className="sit__p">{s.pressure}</p>
          <span className="sit__svc">
            <span className="sr-only">Starts with: </span>
            {(SCENARIO_PAGE_SERVICES[s.id] || []).map((v) => (
              <i key={v}>{PAGE_SERVICES[v].name}</i>
            ))}
          </span>
          <Link className="sit__go" href={href}>
            View this situation
          </Link>
        </div>
      </div>
    </li>
  );
}

/**
 * Start from a situation: three category panels from the site's own situation list.
 * Details show on hover, focus, or tap. "Describe your own" is last and links to
 * /describe-your-situation.
 */
export function SituationPicker(): JSX.Element {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((cur) => ({ ...cur, [id]: !cur[id] }));
  return (
    <div className="sits__board">
      <div className="sits__panels">
        {SCENARIO_GROUPS.map((g) => (
          <section key={g.id} className={`sitpanel sitpanel--${g.id}`} aria-labelledby={`sitpanel-${g.id}`}>
            <header className="sitpanel__head">
              <span className="sitpanel__icon" aria-hidden="true">
                <GroupIcon id={g.id} />
              </span>
              <div>
                <h3 id={`sitpanel-${g.id}`}>{g.heading}</h3>
                <p>{g.line}</p>
              </div>
            </header>
            {g.id === "now" && (
              <p className="sits__urgent">
                <b>Happening right now?</b> Don&rsquo;t wait for a Fit Call.{" "}
                <button
                  type="button"
                  className="textlink"
                  onClick={() =>
                    openMspAdvisor({
                      context: "home",
                      tab: "chat",
                      seedMessage: "Something is happening right now and I need help.",
                    })
                  }
                >
                  Open DE Desk
                </button>{" "}
                and say so.
              </p>
            )}
            <ul className="sitpanel__list" aria-label={g.heading}>
              {SCENARIOS.filter((s) => s.group === g.id).map((s) => (
                <SituationCard key={s.id} s={s} open={!!open[s.id]} onToggle={() => toggle(s.id)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="sit sit--own" id="sit-own">
        <Link className="sit__own" href={DESCRIBE_PATH}>
          <span className="sitpanel__icon sitpanel__icon--own" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 19.5h14" />
              <path d="M7.5 15.5 17 6l2.5 2.5-9.5 9.5H7.5v-2.5z" />
            </svg>
          </span>
          <span className="sit__own-copy">
            <span className="sit__g sit__g--own">Your situation</span>
            <b className="sit__t">Describe your own</b>
            <span className="sit__p">
              Say it in your words. DE Desk finds the closest situation and what Digerati&nbsp;Experts would look at.
            </span>
          </span>
          <span className="sit__own-go">
            Start a smart match
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
            </svg>
          </span>
        </Link>
      </div>
    </div>
  );
}

