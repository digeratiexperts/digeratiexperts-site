// Chapter rail (Exploration, 2026-10-18): turns an existing card grid into a horizontal, snap-scrolling
// carousel with arrows, dots and keyboard support, without changing the cards or their content.
// It attaches to a grid already in the DOM by selector, so the live section components stay untouched.
import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  sectionRef: RefObject<HTMLElement>;
  gridSelector: string;
  label: string;
};

export function ChapterRail({ sectionRef, gridSelector, label }: Props): JSX.Element | null {
  const [count, setCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [overflows, setOverflows] = useState(false);
  const gridRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const grid = section.querySelector<HTMLElement>(gridSelector);
    if (!grid) return;
    gridRef.current = grid;
    grid.classList.add("hc-rail");
    grid.tabIndex = 0;
    grid.setAttribute("aria-label", `${label}, use arrow keys to move`);
    setCount(grid.children.length);

    // Controls only when the row actually overflows; a row that fits needs none.
    const measure = () => setOverflows(grid.scrollWidth > grid.clientWidth + 8);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(grid);

    const onScroll = () => {
      const first = grid.children[0] as HTMLElement | undefined;
      const w = (first?.offsetWidth ?? 1) + 16;
      setIndex(Math.round(grid.scrollLeft / w));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      go(index + (e.key === "ArrowRight" ? 1 : -1));
    };
    grid.addEventListener("scroll", onScroll, { passive: true });
    grid.addEventListener("keydown", onKey);
    return () => {
      grid.removeEventListener("scroll", onScroll);
      grid.removeEventListener("keydown", onKey);
      ro?.disconnect();
      grid.classList.remove("hc-rail");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionRef, gridSelector, label]);

  const go = (next: number) => {
    const grid = gridRef.current;
    if (!grid) return;
    const clamped = Math.max(0, Math.min(count - 1, next));
    const slide = grid.children[clamped] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setIndex(clamped);
  };

  if (count < 2 || !overflows) return null;

  return (
    <div className="hc-railbar">
      <button type="button" className="hc-arrow" onClick={() => go(index - 1)} disabled={index === 0} aria-label={`Previous ${label}`}>
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="hc-dots" role="group" aria-label={`Choose ${label}`}>
        {Array.from({ length: count }, (_, i) => (
          <button key={i} type="button" className={`hc-dot${i === index ? " is-on" : ""}`} onClick={() => go(i)} aria-label={`${label} ${i + 1} of ${count}`} aria-current={i === index ? "true" : undefined} />
        ))}
      </div>
      <button type="button" className="hc-arrow" onClick={() => go(index + 1)} disabled={index >= count - 1} aria-label={`Next ${label}`}>
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
