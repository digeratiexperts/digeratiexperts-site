// Concept (2026-11-13): /concepts/home-v2, Homepage v2 as it stood before Homepage B3 took "/".
// Renders HomepageV2 unchanged so B3 can be compared with it. Review only: noindex, not in navigation.
import HomepageV2 from "@/pages/homepage-v2/HomepageV2";
import { useSEO } from "@/hooks/useSEO";

export default function HomeV2() {
  // Effects run child-first, so this runs after HomepageV2's own useSEO and wins the title, canonical and robots.
  useSEO({
    title: "Concept: homepage v2",
    description: "Review copy of Homepage v2. Not the live homepage.",
    canonical: "/",
    noIndex: true,
  });
  return <HomepageV2 />;
}
