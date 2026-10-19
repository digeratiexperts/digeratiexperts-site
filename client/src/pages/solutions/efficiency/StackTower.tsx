import { useState } from "react";

const BRICKS = ["Identity", "Devices", "Network", "Backup"];

/**
 * Hero aside: the foundation → operations → data → AI stack, drawn in code.
 * "Pull a foundation brick" knocks the backup brick out and the stack tips, so
 * the AI layer visibly has nothing to stand on. A diagram, not data.
 */
export function StackTower() {
  const [pulled, setPulled] = useState(false);

  return (
    <figure className="eba-tower" data-pulled={pulled ? "" : undefined}>
      <div className="eba-tower-stage" aria-hidden="true">
        <div className="eba-tower-upper">
          <div className="eba-slab eba-slab--ai">AI</div>
          <div className="eba-slab eba-slab--ready">Data &amp; access</div>
          <div className="eba-slab eba-slab--ops">Team &amp; operations</div>
        </div>
        <div className="eba-base">
          {BRICKS.map((brick) => (
            <div key={brick} className="eba-brick" data-brick={brick.toLowerCase()}>
              {brick}
            </div>
          ))}
        </div>
        <p className="eba-tower-ground">Security foundation</p>
      </div>
      <figcaption className="eba-tower-caption">
        <p className="eba-label">Where the budget goes first</p>
        <p className="eba-tower-status" aria-live="polite">
          {pulled
            ? "One brick out and the whole stack tips. AI has nothing to stand on."
            : "Foundation at the bottom, AI on top. Each layer stands on the one beneath it."}
        </p>
        <button
          type="button"
          className="eba-pill"
          aria-pressed={pulled}
          onClick={() => setPulled((p) => !p)}
          data-testid="eba-tower-toggle"
        >
          {pulled ? "Put the brick back" : "Pull a foundation brick"}
        </button>
      </figcaption>
    </figure>
  );
}
