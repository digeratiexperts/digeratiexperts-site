// Concept (Exploration, 2026-10-23): /concepts/home-classic, the homepage as it stood before Homepage v2.
// Renders HomepageV8 unchanged, so v2 can be compared with the current page. Review only: noindex, not in navigation.
import HomepageV8 from "@/pages/versions/v8/HomepageV8";
import { useSEO } from "@/hooks/useSEO";

export default function HomeClassic() {
  // Effects run child-first, so this runs after HomepageV8's own useSEO and wins the title, canonical and robots.
  useSEO({
    title: "Concept: homepage classic",
    description: "Review copy of the homepage before Homepage v2. Not the live homepage.",
    canonical: "/",
    noIndex: true,
  });
  return <HomepageV8 />;
}
