import { useEffect, type ReactNode } from "react";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";

const JELLY_CLASS = "de-store-jelly";

/**
 * Every Door 2 page renders inside this frame (source of truth §5.6). It
 * loads the Store stylesheet through StorePageAtmosphere (Store chunk, never
 * the entry sheet), mounts the atmosphere at the page's intensity (0.44 on
 * /store, 0.28 on family and workspace, 0 on contact and confirmation), sets
 * html.de-store-jelly on the three building pages only, and starts every
 * page at the top. Announcements go through the sitewide announcer, so the
 * page carries exactly one polite live region.
 */
export function Door2Frame({
  intensity,
  jelly = false,
  children,
}: {
  intensity: number;
  jelly?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(JELLY_CLASS, jelly);
    return () => root.classList.remove(JELLY_CLASS);
  }, [jelly]);

  return (
    <div className="d2-page">
      <div className="relative">
        {intensity > 0 ? <StorePageAtmosphere intensity={intensity} /> : null}
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}
