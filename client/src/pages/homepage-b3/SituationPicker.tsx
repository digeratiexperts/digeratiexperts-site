import { useState } from "react";
import { Link } from "wouter";
import { PAGE_SERVICES, PICKER_GROUPS, SCENARIOS, SCENARIO_PAGE_SERVICES, type PickerGroup } from "@shared/situationMatch";
import { openMspAdvisor } from "@/lib/openMspAdvisor";

export const DESCRIBE_PATH = "/describe-your-situation";

function groupLabel(id: string): string {
  return PICKER_GROUPS.find((g) => g.id === id)?.label || "";
}

/**
 * "Start from a situation": the site's own situation list (solutionScenarios.ts),
 * grouped and filterable. "Describe your own" is a regular card and is always last,
 * in every filter. Every card opens /describe-your-situation.
 */
export function SituationPicker(): JSX.Element {
  const [filter, setFilter] = useState<PickerGroup["id"]>("all");
  const shown = SCENARIOS.filter((s) => filter === "all" || s.group === filter);
  return (
    <>
      <div className="sits__filters" role="group" aria-label="Filter situations">
        {PICKER_GROUPS.map((g) => (
          <button key={g.id} type="button" className="sitf" data-g={g.id} aria-pressed={filter === g.id} onClick={() => setFilter(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      {filter === "now" && (
        <p className="sits__urgent">
          <b>Happening right now?</b> Don&rsquo;t wait for a Fit Call.{" "}
          <button type="button" className="textlink" onClick={() => openMspAdvisor({ context: "home", tab: "chat", seedMessage: "Something is happening right now and I need help." })}>
            Open DE Desk
          </button>{" "}
          and say so.
        </p>
      )}
      <ul className="sits__grid" aria-label="Situations">
        {shown.map((s) => (
          <li key={s.id} className="sit" id={`sit-${s.id}`} data-g={s.group}>
            <Link className="sit__btn" href={`${DESCRIBE_PATH}?s=${encodeURIComponent(s.id)}`}>
              <span className={`sit__g sit__g--${s.group}`}>{groupLabel(s.group)}</span>
              <b className="sit__t">{s.title}</b>
              <span className="sit__p">{s.pressure}</span>
              <span className="sit__svc">
                <span className="sr-only">Starts with: </span>
                {(SCENARIO_PAGE_SERVICES[s.id] || []).map((v) => (
                  <i key={v}>{PAGE_SERVICES[v].name}</i>
                ))}
              </span>
            </Link>
          </li>
        ))}
        <li className="sit sit--own" id="sit-own" data-g="any">
          <Link className="sit__btn" href={DESCRIBE_PATH}>
            <span className="sit__g sit__g--own">Your situation</span>
            <b className="sit__t">Describe your own</b>
            <span className="sit__p">Say it in your words. DE Desk finds the closest situation and what Digerati&nbsp;Experts would look at.</span>
            <span className="sit__svc">
              <i>Smart match</i>
              <i>A plan you can take</i>
            </span>
          </Link>
        </li>
      </ul>
    </>
  );
}
