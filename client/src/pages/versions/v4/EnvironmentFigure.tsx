/**
 * One illustrative environment. The same marks appear misaligned, then aligned.
 * Not a customer's network and not a live operations view.
 */
const NODES = [
  { id: "people", label: "People", x: 118, y: 78, dx: -28, dy: -18 },
  { id: "identity", label: "Identity", x: 250, y: 54, dx: 8, dy: -26 },
  { id: "endpoints", label: "Endpoints", x: 430, y: 86, dx: 30, dy: -10 },
  { id: "email", label: "Email", x: 540, y: 168, dx: 26, dy: 8 },
  { id: "cloud", label: "Cloud", x: 500, y: 286, dx: 22, dy: 24 },
  { id: "network", label: "Network", x: 360, y: 348, dx: 4, dy: 28 },
  { id: "applications", label: "Applications", x: 190, y: 330, dx: -20, dy: 22 },
  { id: "data", label: "Data", x: 86, y: 240, dx: -30, dy: 6 },
  { id: "vendors", label: "Vendors", x: 150, y: 150, dx: -16, dy: -20 },
] as const;

const CX = 320;
const CY = 210;

export function EnvironmentFigure({ titleId }: { titleId: string }) {
  return (
    <svg className="v4-figure" viewBox="0 0 640 420" role="img" aria-labelledby={titleId}>
      <title id={titleId}>Illustrative map of a business environment. Not a live operations view.</title>
      {NODES.map((node) => (
        <line
          key={`${node.id}-link`}
          className="v4-link"
          x1={CX}
          y1={CY}
          x2={node.x}
          y2={node.y}
          stroke="#F7F5F2"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
      ))}
      <circle cx={CX} cy={CY} r="7" fill="#D3126A" />
      <text x={CX} y={CY + 28} textAnchor="middle" fill="#F7F5F2" fontSize="13" fontFamily="Inter, system-ui, sans-serif">
        The business
      </text>
      {NODES.map((node) => (
        <g key={node.id} className="v4-node" style={{ ["--dx" as string]: node.dx, ["--dy" as string]: node.dy }}>
          <circle cx={node.x} cy={node.y} r="4.5" fill="#F7F5F2" />
          <text
            x={node.x}
            y={node.y - 12}
            textAnchor="middle"
            fill="#C9C2B6"
            fontSize="12"
            fontFamily="Inter, system-ui, sans-serif"
          >
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
