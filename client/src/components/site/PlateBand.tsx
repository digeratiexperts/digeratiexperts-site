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
import aboutAvif from "@/assets/flagship/about-aligned-stack.jpg?w=800;1400;2200&format=avif&as=srcset";
import aboutWebp from "@/assets/flagship/about-aligned-stack.jpg?w=800;1400;2200&format=webp&as=srcset";
import aboutJpg from "@/assets/flagship/about-aligned-stack.jpg?w=1400&format=jpg";
import assessmentAvif from "@/assets/flagship/assessment-lattice-scan.jpg?w=800;1400;2200&format=avif&as=srcset";
import assessmentWebp from "@/assets/flagship/assessment-lattice-scan.jpg?w=800;1400;2200&format=webp&as=srcset";
import assessmentJpg from "@/assets/flagship/assessment-lattice-scan.jpg?w=1400&format=jpg";
import backupAvif from "@/assets/flagship/backup-layered-glass.jpg?w=800;1400;2200&format=avif&as=srcset";
import backupWebp from "@/assets/flagship/backup-layered-glass.jpg?w=800;1400;2200&format=webp&as=srcset";
import backupJpg from "@/assets/flagship/backup-layered-glass.jpg?w=1400&format=jpg";
import contactAvif from "@/assets/flagship/contact-two-tiles.jpg?w=800;1400;2200&format=avif&as=srcset";
import contactWebp from "@/assets/flagship/contact-two-tiles.jpg?w=800;1400;2200&format=webp&as=srcset";
import contactJpg from "@/assets/flagship/contact-two-tiles.jpg?w=1400&format=jpg";
import identityAvif from "@/assets/flagship/identity-gated-path.jpg?w=800;1400;2200&format=avif&as=srcset";
import identityWebp from "@/assets/flagship/identity-gated-path.jpg?w=800;1400;2200&format=webp&as=srcset";
import identityJpg from "@/assets/flagship/identity-gated-path.jpg?w=1400&format=jpg";
import industriesAvif from "@/assets/flagship/industries-grid-lift.jpg?w=800;1400;2200&format=avif&as=srcset";
import industriesWebp from "@/assets/flagship/industries-grid-lift.jpg?w=800;1400;2200&format=webp&as=srcset";
import industriesJpg from "@/assets/flagship/industries-grid-lift.jpg?w=1400&format=jpg";
import locationsAvif from "@/assets/flagship/locations-arizona-stone.jpg?w=800;1400;2200&format=avif&as=srcset";
import locationsWebp from "@/assets/flagship/locations-arizona-stone.jpg?w=800;1400;2200&format=webp&as=srcset";
import locationsJpg from "@/assets/flagship/locations-arizona-stone.jpg?w=1400&format=jpg";
import monitoringAvif from "@/assets/flagship/monitoring-quiet-field.jpg?w=800;1400;2200&format=avif&as=srcset";
import monitoringWebp from "@/assets/flagship/monitoring-quiet-field.jpg?w=800;1400;2200&format=webp&as=srcset";
import monitoringJpg from "@/assets/flagship/monitoring-quiet-field.jpg?w=1400&format=jpg";
import pricingAvif from "@/assets/flagship/pricing-four-tiers.jpg?w=800;1400;2200&format=avif&as=srcset";
import pricingWebp from "@/assets/flagship/pricing-four-tiers.jpg?w=800;1400;2200&format=webp&as=srcset";
import pricingJpg from "@/assets/flagship/pricing-four-tiers.jpg?w=1400&format=jpg";
import resourcesAvif from "@/assets/flagship/resources-library-fan.jpg?w=800;1400;2200&format=avif&as=srcset";
import resourcesWebp from "@/assets/flagship/resources-library-fan.jpg?w=800;1400;2200&format=webp&as=srcset";
import resourcesJpg from "@/assets/flagship/resources-library-fan.jpg?w=1400&format=jpg";
import comanagedAvif from "@/assets/flagship/solutions-co-managed.jpg?w=800;1400;2200&format=avif&as=srcset";
import comanagedWebp from "@/assets/flagship/solutions-co-managed.jpg?w=800;1400;2200&format=webp&as=srcset";
import comanagedJpg from "@/assets/flagship/solutions-co-managed.jpg?w=1400&format=jpg";

/*
 * A photographic interlude between chapters on long pages: one plate from the
 * approved tile series (glass, ceramic, graphite; design/IMAGERY.md, Joe
 * 2026-10-05), drifting on scroll. Decorative only: no copy, no claim, hidden
 * from assistive tech. Under reduced motion the plate holds still.
 *
 * row, ring, field and white are the first series. The page plates (about,
 * assessment, backup, contact, identity, industries, locations, monitoring,
 * pricing, resources, comanaged) were each written for one page or service;
 * see artifacts/kie-ai/nano-banana/prompts/site/. A "whole" plate is a tall
 * subject that a wide band would crop to one slab, so it is fitted, not cropped.
 */
export type PlateName = "row" | "ring" | "field" | "white" | "about" | "assessment" | "backup" | "contact" | "identity" | "industries" | "locations" | "monitoring" | "pricing" | "resources" | "comanaged";

const PLATES: Record<PlateName, { avif: string; webp: string; jpg: string; position: string; light?: boolean; whole?: boolean }> = {
  row: { avif: rowAvif, webp: rowWebp, jpg: rowJpg, position: "50% 30%" },
  ring: { avif: ringAvif, webp: ringWebp, jpg: ringJpg, position: "72% 50%" },
  field: { avif: fieldAvif, webp: fieldWebp, jpg: fieldJpg, position: "62% 50%" },
  white: { avif: whiteAvif, webp: whiteWebp, jpg: whiteJpg, position: "50% 60%", light: true },
  about: { avif: aboutAvif, webp: aboutWebp, jpg: aboutJpg, position: "30% 50%", whole: true },
  assessment: { avif: assessmentAvif, webp: assessmentWebp, jpg: assessmentJpg, position: "60% 45%" },
  backup: { avif: backupAvif, webp: backupWebp, jpg: backupJpg, position: "50% 50%", whole: true },
  contact: { avif: contactAvif, webp: contactWebp, jpg: contactJpg, position: "50% 55%" },
  identity: { avif: identityAvif, webp: identityWebp, jpg: identityJpg, position: "60% 50%" },
  industries: { avif: industriesAvif, webp: industriesWebp, jpg: industriesJpg, position: "55% 50%" },
  locations: { avif: locationsAvif, webp: locationsWebp, jpg: locationsJpg, position: "60% 55%" },
  monitoring: { avif: monitoringAvif, webp: monitoringWebp, jpg: monitoringJpg, position: "50% 55%" },
  pricing: { avif: pricingAvif, webp: pricingWebp, jpg: pricingJpg, position: "55% 55%", light: true },
  resources: { avif: resourcesAvif, webp: resourcesWebp, jpg: resourcesJpg, position: "50% 55%", light: true },
  comanaged: { avif: comanagedAvif, webp: comanagedWebp, jpg: comanagedJpg, position: "55% 50%" },
};

/** The plate a data-driven service or industry page shows, by its route key. */
export function plateForServiceKey(key: string | undefined): PlateName {
  switch (key) {
    case "cloud-backup":
      return "backup";
    case "threat-detection":
    case "security-operations":
    case "managed-it-support":
      return "monitoring";
    case "unified-security":
    case "data-encryption":
      return "identity";
    case "compliance-reports":
      return "assessment";
    case "vcio-strategy":
      return "about";
    case "professional-services":
      return "industries";
    default:
      return "row";
  }
}

export function PlateBand({ plate, className, depth = -56 }: { plate: PlateName; className?: string; depth?: number }) {
  const p = PLATES[plate];
  return (
    <figure aria-hidden="true" className={cn("de-plate-band", p.light && "de-plate-band--light", p.whole && "de-plate-band--whole", className)} data-plate={plate}>
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
