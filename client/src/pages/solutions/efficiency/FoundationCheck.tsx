import { useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { buttonPrimary } from "@/components/site/chapters";
import { FOUNDATION_GAPS, scoreFoundation } from "./efficiencyModel";

/**
 * Six foundation failures as a self-check. Each tick cracks a brick in the
 * wall and tips the AI slab sitting on it. Illustrative, not an assessment.
 */
export function FoundationCheck() {
  const [checked, setChecked] = useState<string[]>([]);
  const count = checked.length;
  const result = scoreFoundation(count);
  const toggle = (id: string) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const tilt = { "--eba-tilt": `${count * 2}deg`, "--eba-shift": `${count * 0.3}rem` } as CSSProperties;

  return (
    <div className="eba-check">
      <fieldset className="eba-check-set">
        <legend className="eba-check-legend">Has any of this happened at your business in the last 12 months?</legend>
        <ul className="eba-check-grid">
          {FOUNDATION_GAPS.map((gap) => {
            const on = checked.includes(gap.id);
            return (
              <li key={gap.id}>
                <label className="eba-check-item" data-checked={on ? "" : undefined}>
                  <input
                    type="checkbox"
                    className="eba-check-input"
                    checked={on}
                    onChange={() => toggle(gap.id)}
                    data-testid={`eba-gap-${gap.id}`}
                  />
                  <span>{gap.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <aside className="eba-meter" aria-label="Your foundation">
        <div className="eba-wall" style={tilt} aria-hidden="true">
          <div className="eba-wall-ai">AI</div>
          <div className="eba-wall-bricks">
            {FOUNDATION_GAPS.map((gap) => (
              <span key={gap.id} className="eba-wall-brick" data-cracked={checked.includes(gap.id) ? "" : undefined}>
                <svg viewBox="0 0 60 24" preserveAspectRatio="none">
                  <path pathLength={1} d="M4 3 L18 11 L13 14 L30 21 L26 13 L44 17 L40 9 L57 4" />
                </svg>
              </span>
            ))}
          </div>
        </div>
        <div aria-live="polite" data-testid="eba-check-result">
          <p className="eba-meter-count">
            {count} <span>of {FOUNDATION_GAPS.length}</span>
          </p>
          <p className="eba-meter-level">{result.level}</p>
          <p className="eba-meter-message">{result.message}</p>
        </div>
        <div className="eba-meter-actions">
          <a href="/book" className={buttonPrimary("paper")} data-testid="eba-check-cta">
            Get My Cyber Risk Assessment
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          {count > 0 && (
            <button type="button" className="eba-text-btn" onClick={() => setChecked([])}>
              Clear answers
            </button>
          )}
        </div>
        <p className="eba-meter-note">
          Illustrative self-check, not an assessment. AI inherits what is underneath it: if files are disorganized
          and permissions are wide open, AI surfaces that faster than anyone.
        </p>
      </aside>
    </div>
  );
}
