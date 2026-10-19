import { useState } from "react";
import { GraduationCap, HardDrive, Headphones, ShieldCheck, type LucideIcon } from "lucide-react";
import { IconWell } from "@/components/visual/IconWell";
import { BUDGET_LINES, summarizeBudget } from "./efficiencyModel";

const ICONS: Record<string, LucideIcon> = {
  hardware: HardDrive,
  training: GraduationCap,
  recovery: ShieldCheck,
  support: Headphones,
};

/**
 * Move a basic into the AI pilot and watch its share of the bar slide across
 * and the card say where the risk lands. Qualitative only: equal shares, no
 * dollar figures.
 */
export function BudgetBalancer() {
  const [cut, setCut] = useState<string[]>([]);
  const summary = summarizeBudget(cut);
  const toggle = (id: string) => setCut((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="eba-budget">
      <div className="eba-bar-wrap">
        <div className="eba-bar-legend" aria-hidden="true">
          <span>Your IT budget</span>
          <span>AI pilot</span>
        </div>
        <div className="eba-bar" aria-hidden="true">
          {BUDGET_LINES.map((line) => (
            <span key={line.id} className="eba-seg" data-cut={cut.includes(line.id) ? "" : undefined}>
              {line.short}
            </span>
          ))}
          <span className="eba-seg eba-seg--ai" style={{ flexGrow: summary.cut }}>
            AI pilot
          </span>
        </div>
      </div>

      <ul className="eba-lines">
        {BUDGET_LINES.map((line) => {
          const isCut = cut.includes(line.id);
          return (
            <li key={line.id} className="eba-line" data-cut={isCut ? "" : undefined}>
              <div className="eba-line-top">
                <IconWell icon={ICONS[line.id]} surface="dark" />
                <span className="eba-stamp" aria-hidden={!isCut}>
                  Cut to fund AI
                </span>
              </div>
              <h3 className="eba-line-title">{line.title}</h3>
              <p className="eba-line-text">{line.text}</p>
              <div className="eba-line-risk" aria-hidden={!isCut}>
                <p>
                  Risk moves to <strong>{line.riskMovesTo}</strong>
                </p>
              </div>
              <button
                type="button"
                className="eba-pill eba-line-btn"
                aria-pressed={isCut}
                onClick={() => toggle(line.id)}
                data-testid={`eba-cut-${line.id}`}
              >
                {isCut ? "Restore funding" : "Move to the AI pilot"}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="eba-readout">
        <div aria-live="polite" data-testid="eba-budget-result">
          <p className="eba-readout-headline">{summary.headline}</p>
          <p className="eba-readout-detail">{summary.detail}</p>
        </div>
        {summary.cut > 0 && (
          <button type="button" className="eba-pill" onClick={() => setCut([])}>
            Restore every line
          </button>
        )}
      </div>
      <p className="eba-label eba-label--muted eba-budget-note">Illustrative: equal shares, no dollar figures</p>
    </div>
  );
}
