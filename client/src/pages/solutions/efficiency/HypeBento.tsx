import { Megaphone } from "lucide-react";
import { IconWell } from "@/components/visual/IconWell";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

export type HypeItem = { pitch: string; reality: string };

const NOISE_BARS = [38, 72, 54, 92, 66, 100, 48, 84, 60, 96, 42, 78, 58, 88, 50, 70, 36, 64];

/**
 * The fear pitches as a bento: the lead pitch gets the large card, and each
 * pitch is struck through as it scrolls into view, with the reality beneath.
 * The lead card's "noise" bars flatten at the same time.
 */
export function HypeBento({ items }: { items: HypeItem[] }) {
  const { ref, hasIntersected } = useIntersectionObserver<HTMLUListElement>({ threshold: 0.25 });

  return (
    <ul ref={ref} className="eba-hype" data-inview={hasIntersected ? "" : undefined}>
      {items.map((item, i) => (
        <li key={item.pitch} className={i === 0 ? "eba-hype-card eba-hype-card--lead" : "eba-hype-card"}>
          <div className="eba-hype-head">
            <IconWell icon={Megaphone} surface="dark" />
            {i === 0 && (
              <div className="eba-noise" aria-hidden="true">
                {NOISE_BARS.map((h, n) => (
                  <span key={n} style={{ height: `${h}%` }} />
                ))}
              </div>
            )}
          </div>
          <p className="eba-label eba-label--muted eba-hype-pitch">The pitch</p>
          <p className="eba-hype-quote">
            <s>{item.pitch}</s>
          </p>
          <p className="eba-label eba-label--accent">The reality</p>
          <p className="eba-hype-real">{item.reality}</p>
        </li>
      ))}
    </ul>
  );
}
