/**
 * The peak act's stage (Scrollcraft build proactive-ecosystem-amplify).
 *
 * A coded technical drawing of the client technology environment. It opens
 * scattered: six domains the page already names (identity, endpoints, email,
 * network, backups, security operations) held apart and disconnected. As the
 * visitor scrolls the pinned act, the domains gather, the connections draw,
 * and the environment resolves into one architecture with principal-led
 * oversight at the center. All motion is CSS driven from the act's --sc-p;
 * with reduced motion or no engine, the assembled state renders complete.
 *
 * Decorative reinforcement of the surrounding text (aria-hidden): every term
 * in it already appears in the page's real copy.
 */
const DOMAINS = [
  { label: "Identity", x: 400, y: 64, sx: -210, sy: -46 },
  { label: "Endpoints", x: 574, y: 138, sx: 150, sy: -84 },
  { label: "Email", x: 574, y: 322, sx: 205, sy: 58 },
  { label: "Network", x: 400, y: 396, sx: -88, sy: 74 },
  { label: "Backups", x: 226, y: 322, sx: -196, sy: 90 },
  { label: "Security Ops", x: 226, y: 138, sx: -132, sy: -108 },
];

const CX = 400;
const CY = 230;

export function EnvironmentAssembly() {
  return (
    <div className="de-assembly" aria-hidden="true">
      <svg viewBox="0 0 800 460" className="de-assembly__svg">
        {/* spokes: each domain into the operating model */}
        {DOMAINS.map((d) => (
          <line
            key={`s-${d.label}`}
            className="de-assembly__wire"
            pathLength={1}
            x1={d.x}
            y1={d.y}
            x2={CX}
            y2={CY}
          />
        ))}
        {/* the ring: domains operating together, not just reporting up */}
        {DOMAINS.map((d, i) => {
          const n = DOMAINS[(i + 1) % DOMAINS.length];
          return (
            <line
              key={`r-${d.label}`}
              className="de-assembly__wire de-assembly__wire--ring"
              pathLength={1}
              x1={d.x}
              y1={d.y}
              x2={n.x}
              y2={n.y}
            />
          );
        })}
        {DOMAINS.map((d) => (
          <g
            key={d.label}
            className="de-assembly__domain"
            style={{ "--sx": `${d.sx}px`, "--sy": `${d.sy}px` } as React.CSSProperties}
          >
            <circle cx={d.x} cy={d.y} r={30} className="de-assembly__well" />
            <circle cx={d.x} cy={d.y} r={4} className="de-assembly__dot" />
            <text x={d.x} y={d.y + 48} textAnchor="middle" className="de-assembly__label">
              {d.label}
            </text>
          </g>
        ))}
        <g className="de-assembly__core">
          <circle cx={CX} cy={CY} r={52} className="de-assembly__coreRing" />
          <circle cx={CX} cy={CY} r={5} className="de-assembly__dot de-assembly__dot--core" />
          <text x={CX} y={CY + 24} textAnchor="middle" className="de-assembly__label de-assembly__label--core">
            Principal-led
          </text>
        </g>
      </svg>
    </div>
  );
}
