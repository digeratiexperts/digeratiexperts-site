import type { ReactNode } from "react";
import type { MotifKey } from "./chapters";

/*
 * Line-art motifs, one per chapter, drawn on a 720 x 480 board anchored to the
 * chapter's top right (or centre) and faded at the edges. Diagram grammar:
 * hairlines in the chapter's ink, one magenta accent, mono micro-labels that
 * only restate the section's own content. `.m-a` is the accent stroke, `.m-d`
 * dashed, `.m-f` a filled dot, `.m-t` a label.
 */

const W = 720;
const H = 480;

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad(a0));
  const y0 = cy + r * Math.sin(rad(a0));
  const x1 = cx + r * Math.cos(rad(a1));
  const y1 = cy + r * Math.sin(rad(a1));
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  const rad = ((a - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

const Node = ({ x, y, r = 5, accent = false }: { x: number; y: number; r?: number; accent?: boolean }) => (
  <>
    <circle cx={x} cy={y} r={r * 2.2} className={accent ? "m-a m-halo" : "m-halo"} />
    <circle cx={x} cy={y} r={r} className={accent ? "m-f m-fa" : "m-f"} />
  </>
);

const T = ({ x, y, children, anchor = "start" }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end" }) => (
  <text x={x} y={y} className="m-t" textAnchor={anchor}>
    {children}
  </text>
);

const MOTIFS: Record<MotifKey, () => JSX.Element> = {
  /* Why we exist: one core, three commitments radiating from it. */
  core: () => (
    <g>
      {[60, 110, 170].map((r) => (
        <circle key={r} cx={520} cy={220} r={r} className={r === 110 ? "m-d" : undefined} />
      ))}
      {[300, 30, 160].map((a, i) => {
        const [x, y] = polar(520, 220, 170, a);
        return (
          <g key={a}>
            <path d={`M520 220L${x} ${y}`} className={i === 0 ? "m-a" : undefined} />
            <Node x={x} y={y} r={4} accent={i === 0} />
          </g>
        );
      })}
      <Node x={520} y={220} r={7} accent />
    </g>
  ),
  /* The exposure: pressure arriving from outside at a perimeter. */
  exposure: () => (
    <g>
      <path d={arc(560, 300, 230, 250, 360)} />
      <path d={arc(560, 300, 200, 250, 360)} className="m-d" />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = 268 + i * 15;
        const [x0, y0] = polar(560, 300, 420, a);
        const [x1, y1] = polar(560, 300, 232, a);
        return (
          <g key={i}>
            <path d={`M${x0} ${y0}L${x1} ${y1}`} className={i === 2 || i === 4 ? "m-a m-d" : "m-d"} />
            <circle cx={x1} cy={y1} r={3} className={i === 2 || i === 4 ? "m-f m-fa" : "m-f"} />
          </g>
        );
      })}
    </g>
  ),
  /* The gaps: a perimeter with six breaks, one per problem in the section. */
  gaps: () => (
    <g>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a0 = i * 60 + 9;
        const [lx, ly] = polar(520, 230, 196, i * 60);
        return (
          <g key={i}>
            <path d={arc(520, 230, 160, a0, a0 + 42)} className={i === 0 ? "m-a" : undefined} />
            <path d={arc(520, 230, 120, a0 + 6, a0 + 36)} className="m-d" />
            <T x={lx} y={ly + 4} anchor="middle">{`0${i + 1}`}</T>
          </g>
        );
      })}
      <circle cx={520} cy={230} r={60} className="m-d" />
      <Node x={520} y={230} r={5} accent />
    </g>
  ),
  /* Three paths: one point, three ways to work with DE. */
  paths: () => (
    <g>
      {[
        ["M300 400C420 400 470 120 690 110", "Fully managed"],
        ["M300 400C440 400 500 260 690 250", "Co-managed"],
        ["M300 400C460 400 520 390 690 390", "Assessment"],
      ].map(([d, label], i) => (
        <g key={label}>
          <path d={d} className={i === 0 ? "m-a" : undefined} />
          <Node x={690} y={[110, 250, 390][i]} r={4} accent={i === 0} />
        </g>
      ))}
      <Node x={300} y={400} r={6} accent />
    </g>
  ),
  /* Eight blocks: seven rings, the eighth (risk and exposure) running continuously outside them. */
  layers: () => (
    <g>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <circle key={n} cx={560} cy={240} r={22 + n * 22} className={n === 1 ? "m-a" : undefined} />
      ))}
      <circle cx={560} cy={240} r={208} className="m-d m-a" />
      <T x={560} y={22} anchor="middle">Risk &amp; exposure · continuous</T>
      <Node x={560} y={240} r={6} accent />
    </g>
  ),
  /* The method: assessment, roadmap, implementation, continuous. */
  method: () => (
    <g>
      <path d="M120 240H600" />
      <path d="M600 240C690 240 690 120 600 120H560" className="m-d" />
      {["Assess", "Roadmap", "Implement", "Continuous"].map((label, i) => (
        <g key={label}>
          <Node x={150 + i * 150} y={240} r={5} accent={i === 3} />
        </g>
      ))}
    </g>
  ),
  /* The proof: a ledger of entries you can check. */
  ledger: () => (
    <g>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i}>
          <path d={`M330 ${90 + i * 48}H690`} className={i === 6 ? "m-d" : undefined} />
          {i < 6 ? <path d={`M336 ${78 + i * 48}l6 6 12-14`} className={i === 2 ? "m-a" : undefined} /> : null}
        </g>
      ))}
    </g>
  ),
  /* The place: contours around the Chandler office. */
  place: () => (
    <g>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path
          key={i}
          d={`M${150 + i * 6} ${430 - i * 34}C${300 + i * 10} ${360 - i * 40} ${430 - i * 8} ${470 - i * 52} ${720} ${300 - i * 34}`}
          className={i === 3 ? "m-d" : undefined}
        />
      ))}
      <path d="M560 160V250M515 205H605" />
      <circle cx={560} cy={205} r={18} className="m-a" />
      <Node x={560} y={205} r={4} accent />
      <T x={584} y={168}>33.30° N · 111.84° W</T>
      <T x={584} y={184}>Chandler, Arizona</T>
    </g>
  ),
  /* The people: one named owner holding three responsibilities. */
  owner: () => (
    <g>
      <circle cx={600} cy={120} r={34} className="m-a" />
      <circle cx={600} cy={120} r={64} className="m-d" />
      <circle cx={600} cy={120} r={100} />
      {[200, 240, 280].map((a) => {
        const [x, y] = polar(600, 120, 100, a);
        return <Node key={a} x={x} y={y} r={4} />;
      })}
      <Node x={600} y={120} r={7} accent />
    </g>
  ),
  /* Your sector: one practice, five industries. */
  sectors: () => (
    <g>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 60 + i * 90;
        return (
          <g key={i}>
            <path d={`M330 240C470 240 520 ${y} 690 ${y}`} className={i === 2 ? "m-a" : undefined} />
            <Node x={690} y={y} r={4} accent={i === 2} />
          </g>
        );
      })}
      <Node x={330} y={240} r={6} accent />
    </g>
  ),
  /* Your fit: four operating models as rising steps, matched rather than ranked. */
  fit: () => (
    <g>
      <path d="M260 420H360V340H460V260H560V180H690" />
      {["IT", "Office", "Business", "Enterprise"].map((label, i) => (
        <g key={label}>
          <Node x={310 + i * 100 + (i === 3 ? 25 : 0)} y={420 - i * 80} r={4} accent={i === 2} />
          <T x={310 + i * 100 + (i === 3 ? 25 : 0)} y={400 - i * 80} anchor="middle">{label}</T>
        </g>
      ))}
      <path d="M560 180V420" className="m-d" />
    </g>
  ),
  /* The intel: sourced items arriving on one timeline. */
  intel: () => (
    <g>
      <path d="M300 240H700" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <path key={i} d={`M${320 + i * 48} ${i % 2 ? 240 : 200}V${i % 2 ? 280 : 240}`} className={i === 5 ? "m-a" : undefined} />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={360 + i * 112} y={100 + (i % 2) * 210} width={96} height={56} rx={10} className={i === 1 ? "m-d" : undefined} />
      ))}
    </g>
  ),
  /* The watch: signal, human triage, named owner. */
  watch: () => (
    <g>
      <path d="M140 360C300 360 300 200 440 200S600 80 690 80" />
      {[
        [140, 360, "Signal"],
        [440, 200, "Human triage"],
        [690, 80, "Named owner"],
      ].map(([x, y, label], i) => (
        <g key={label as string}>
          <Node x={x as number} y={y as number} r={5} accent={i === 2} />
          <T x={(x as number) + (i === 2 ? -14 : 14)} y={(y as number) + 26} anchor={i === 2 ? "end" : "start"}>
            {label}
          </T>
        </g>
      ))}
    </g>
  ),
  /* The start: the thread arrives at the assessment. */
  target: () => (
    <g>
      {[30, 64, 104, 150].map((r) => (
        <circle key={r} cx={560} cy={240} r={r} className={r === 64 ? "m-a" : r === 150 ? "m-d" : undefined} />
      ))}
      <path d="M180 240H500" className="m-d" />
      <path d="M488 230l12 10-12 10" />
      <Node x={560} y={240} r={6} accent />
    </g>
  ),
  /* Your questions: one question branching to plain answers. */
  questions: () => (
    <g>
      <path d="M360 80V200M360 200C360 260 260 260 260 320M360 200C360 260 460 260 460 320M460 320C460 380 400 380 400 430M460 320C460 380 520 380 520 430" />
      <path d="M360 200C360 260 360 260 360 320" className="m-d" />
      {[
        [360, 80],
        [360, 200],
        [260, 320],
        [360, 320],
        [460, 320],
        [400, 430],
        [520, 430],
      ].map(([x, y], i) => (
        <Node key={i} x={x} y={y} r={4} accent={i === 0} />
      ))}
    </g>
  ),
  /* The standards: frameworks mapped as a grid of requirements. */
  standards: () => (
    <g>
      {Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 8 }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={340 + c * 44}
            y={60 + r * 44}
            width={30}
            height={30}
            rx={6}
            className={r === 2 && c === 5 ? "m-a" : (r + c) % 3 === 0 ? "m-d" : undefined}
          />
        )),
      )}
    </g>
  ),
  /* Next step: every line converges on one starting point. */
  converge: () => (
    <g>
      {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${360 + i * 90} 0C${360 + i * 90} 220 360 260 360 430`} className={i === 0 ? "m-a" : Math.abs(i) % 2 ? "m-d" : undefined} />
      ))}
      <Node x={360} y={430} r={6} accent />
    </g>
  ),
  /* Arrive: the thread ends at the office pin. */
  arrive: () => (
    <g>
      {[40, 80, 130].map((r) => (
        <circle key={r} cx={560} cy={200} r={r} className={r === 80 ? "m-d" : undefined} />
      ))}
      <path d="M560 150c-22 0-36 16-36 34 0 26 36 58 36 58s36-32 36-58c0-18-14-34-36-34z" className="m-a" />
      <circle cx={560} cy={186} r={8} className="m-a" />
    </g>
  ),
};

export function Motif({ motif }: { motif: MotifKey }): JSX.Element {
  const Draw = MOTIFS[motif];
  return (
    <svg className="st-motif__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMin meet" focusable="false">
      <Draw />
    </svg>
  );
}
