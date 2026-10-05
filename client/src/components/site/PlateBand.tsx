import { ParallaxLayer } from "@/components/site/Atmosphere";
import { cn } from "@/lib/utils";

import rowAvif from "@/assets/flagship/ways-backdrop.jpg?w=800;1400;2200&format=avif&as=srcset";
import rowWebp from "@/assets/flagship/ways-backdrop.jpg?w=800;1400;2200&format=webp&as=srcset";
import rowJpg from "@/assets/flagship/ways-backdrop.jpg?w=1400&format=jpg";
import ringAvif from "@/assets/flagship/home-managed-core.jpg?w=800;1400;2200&format=avif&as=srcset";
import ringWebp from "@/assets/flagship/home-managed-core.jpg?w=800;1400;2200&format=webp&as=srcset";
import ringJpg from "@/assets/flagship/home-managed-core.jpg?w=1400&format=jpg";
import fieldAvif from "@/assets/flagship/hero-tile-field.jpg?w=800;1400;2200&format=avif&as=srcset";
import fieldWebp from "@/assets/flagship/hero-tile-field.jpg?w=800;1400;2200&format=webp&as=srcset";
import fieldJpg from "@/assets/flagship/hero-tile-field.jpg?w=1400&format=jpg";
import whiteAvif from "@/assets/flagship/close-white.jpg?w=800;1400;2200&format=avif&as=srcset";
import whiteWebp from "@/assets/flagship/close-white.jpg?w=800;1400;2200&format=webp&as=srcset";
import whiteJpg from "@/assets/flagship/close-white.jpg?w=1400&format=jpg";

/*
 * A photographic interlude between chapters on long pages: one plate from the
 * approved tile series (glass, ceramic, graphite; design/IMAGERY.md, Joe
 * 2026-10-05), drifting on scroll. Decorative only: no copy, no claim, hidden
 * from assistive tech. Under reduced motion the plate holds still.
 */
export type PlateName = "row" | "ring" | "field" | "white";

const PLATES: Record<PlateName, { avif: string; webp: string; jpg: string; position: string; light?: boolean }> = {
  row: { avif: rowAvif, webp: rowWebp, jpg: rowJpg, position: "50% 30%" },
  ring: { avif: ringAvif, webp: ringWebp, jpg: ringJpg, position: "72% 50%" },
  field: { avif: fieldAvif, webp: fieldWebp, jpg: fieldJpg, position: "62% 50%" },
  white: { avif: whiteAvif, webp: whiteWebp, jpg: whiteJpg, position: "50% 60%", light: true },
};

export function PlateBand({ plate, className, depth = -56 }: { plate: PlateName; className?: string; depth?: number }) {
  const p = PLATES[plate];
  return (
    <figure aria-hidden="true" className={cn("de-plate-band", p.light && "de-plate-band--light", className)} data-plate={plate}>
      <ParallaxLayer depth={depth} className="de-plate-band__layer">
        <picture>
          <source type="image/avif" srcSet={p.avif} sizes="(min-width: 1280px) 1200px, 100vw" />
          <source type="image/webp" srcSet={p.webp} sizes="(min-width: 1280px) 1200px, 100vw" />
          <img src={p.jpg} width={2400} height={1340} alt="" loading="lazy" decoding="async" style={{ objectPosition: p.position }} />
        </picture>
      </ParallaxLayer>
    </figure>
  );
}
