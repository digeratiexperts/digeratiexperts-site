export interface FolioChapter {
  /** Anchor id of the chapter section on the page. */
  id: string;
  /** Short label, taken from the chapter's existing heading language. */
  label: string;
}

/**
 * The signature move (Scrollcraft build proactive-ecosystem-amplify): a fixed
 * margin folio that keeps a live map of the client technology environment.
 * Each chapter the visitor passes lights one node and draws its link, so by
 * the close the map is a complete record of the journey, and it doubles as
 * chapter navigation. Desktop only (xl and up); the page reads identically
 * without it.
 *
 * Node positions trace a ring so the finished shape reads as one connected
 * environment rather than a checklist.
 */
const RING: Array<{ x: number; y: number }> = [
  { x: 40, y: 8 },
  { x: 66, y: 20 },
  { x: 72, y: 46 },
  { x: 56, y: 68 },
  { x: 24, y: 68 },
  { x: 8, y: 46 },
  { x: 14, y: 20 },
];

export function EnvironmentFolio({
  chapters,
  reached,
}: {
  chapters: FolioChapter[];
  reached: number;
}) {
  const current = Math.max(0, Math.min(reached, chapters.length) - 1);
  return (
    <nav
      aria-label="Chapters"
      className="de-folio"
      data-testid="scrollstory-folio"
    >
      <p className="de-folio__now" aria-live="polite">
        <span className="de-folio__num">{String(current + 1).padStart(2, "0")}</span>
        <span className="de-folio__title">{chapters[current]?.label ?? ""}</span>
      </p>
      <svg viewBox="0 0 80 80" className="de-folio__map" aria-hidden="true">
        {chapters.map((_, i) => {
          if (i === 0) return null;
          const a = RING[(i - 1) % RING.length];
          const b = RING[i % RING.length];
          return (
            <line
              key={`l${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={i < reached ? "de-folio__link is-lit" : "de-folio__link"}
            />
          );
        })}
        {reached >= chapters.length && chapters.length > 2 && (
          <line
            x1={RING[(chapters.length - 1) % RING.length].x}
            y1={RING[(chapters.length - 1) % RING.length].y}
            x2={RING[0].x}
            y2={RING[0].y}
            className="de-folio__link is-lit"
          />
        )}
        {chapters.map((_, i) => {
          const p = RING[i % RING.length];
          return (
            <circle
              key={`n${i}`}
              cx={p.x}
              cy={p.y}
              r={3}
              className={i < reached ? "de-folio__node is-lit" : "de-folio__node"}
            />
          );
        })}
      </svg>
      <ol className="de-folio__list">
        {chapters.map((ch, i) => (
          <li key={ch.id}>
            <button
              type="button"
              className={i < reached ? "de-folio__jump is-lit" : "de-folio__jump"}
              aria-current={i === current ? "true" : undefined}
              onClick={() =>
                document
                  .getElementById(ch.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {ch.label}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
