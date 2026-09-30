import { Link } from "wouter";
import type { CuratedSolutionFamily } from "@/data/curatedSolutions";
import { familyPath, getFamilyById } from "@/lib/businessNeeds";
import { FAMILY_SECURITY_BLOCKS, SECURITY_BLOCKS, type CoverageView } from "@/lib/solutionGuidance";

const HANDLE_OUR_IT_PATH = "/solutions/proactive-ecosystem";

function label(id: string): string {
  return getFamilyById(id)?.label ?? id;
}

/**
 * Where the solution sits in DE's eight security blocks. Structure, not a
 * score: seven cells, the Risk & Exposure band beneath, and the families that
 * are an operating layer rather than a block. Never a percentage or a ring.
 */
export function CoverageBand({
  coverage,
  onAdd,
  maxAdds = Infinity,
}: {
  coverage: CoverageView;
  onAdd?: (familyId: CuratedSolutionFamily["id"]) => void;
  /** How many "Available · Add …" links may render (the page caps suggestions at three, hints first). */
  maxAdds?: number;
}) {
  const cells = coverage.cells.filter((cell) => cell.layer === "block");
  const band = coverage.cells.find((cell) => cell.layer === "continuous");
  let addsLeft = maxAdds;
  const takeAdd = () => {
    if (addsLeft <= 0) return false;
    addsLeft -= 1;
    return true;
  };
  return (
    <div data-testid="coverage-band">
      <div className="d2-coverage">
        {cells.map((cell) => (
          <div key={cell.id} className="d2-coverage__cell" data-state={cell.state}>
            <p className="d2-small font-semibold">{cell.label}</p>
            <span className="d2-coverage__state d2-micro">
              {cell.state === "in_solution" ? (
                `In your solution · ${cell.coveredBy.map(label).join(", ")}`
              ) : cell.state === "available" && cell.addFamilyId ? (
                !takeAdd() ? (
                  `Available · ${label(cell.addFamilyId)}`
                ) : onAdd ? (
                  <button type="button" className="d2-link" onClick={() => onAdd(cell.addFamilyId!)}>
                    Available · Add {label(cell.addFamilyId)}<span aria-hidden="true"> →</span>
                  </button>
                ) : (
                  <Link href={familyPath(cell.addFamilyId)} className="d2-link">
                    Available · Add {label(cell.addFamilyId)}<span aria-hidden="true"> →</span>
                  </Link>
                )
              ) : (
                <Link href={HANDLE_OUR_IT_PATH} className="d2-link">
                  Part of Handle Our IT<span aria-hidden="true"> →</span>
                </Link>
              )}
            </span>
          </div>
        ))}
        {band ? (
          <div className="d2-coverage__band" data-state={band.state}>
            <p className="d2-small font-semibold">{band.label}</p>
            <span className="d2-coverage__state d2-micro">
              {band.state === "in_solution"
                ? `In your solution · ${band.coveredBy.map(label).join(", ")}`
                : band.addFamilyId
                  ? !takeAdd()
                    ? `Available · ${label(band.addFamilyId)}`
                    : onAdd
                    ? (
                        <button type="button" className="d2-link" onClick={() => onAdd(band.addFamilyId!)}>
                          Available · Add {label(band.addFamilyId)}<span aria-hidden="true"> →</span>
                        </button>
                      )
                    : (
                        <Link href={familyPath(band.addFamilyId)} className="d2-link">
                          Available · Add {label(band.addFamilyId)}<span aria-hidden="true"> →</span>
                        </Link>
                      )
                  : "Continuous layer"}
            </span>
          </div>
        ) : null}
      </div>
      {coverage.outsideBlocks.length > 0 ? (
        <p className="d2-small d2-ink-soft mt-3">
          Also in this solution: {coverage.outsideBlocks.map(label).join(", ")} (operating layer, not security blocks)
        </p>
      ) : null}
      <p className="d2-micro d2-ink-soft mt-3">Structure, not a rating.</p>
    </div>
  );
}

/** The blocks one family touches, as chips; or the honest line for a family outside the eight. */
export function CoverageChips({ familyId }: { familyId: CuratedSolutionFamily["id"] }) {
  const blocks = FAMILY_SECURITY_BLOCKS[familyId] ?? [];
  if (blocks.length === 0) {
    return <p className="d2-small d2-ink-soft">Also in this solution: operating layer, not a security block.</p>;
  }
  return (
    <ul className="d2-chips-row" aria-label="Security blocks this package works in">
      {SECURITY_BLOCKS.filter((block) => blocks.includes(block.id)).map((block) => (
        <li key={block.id} className="d2-chip" data-state="in_solution">
          {block.label}
        </li>
      ))}
    </ul>
  );
}
