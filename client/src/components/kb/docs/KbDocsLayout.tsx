import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import "./kbDocs.css";

/**
 * Docs-style three-column shell: category tree (left, sticky, own scroll),
 * reading column (centre, ~760px), "On this page" (right, sticky).
 *
 * Below ~900px of container width the tree folds into a toggle above the
 * article (Escape closes it and returns focus to the toggle); below ~1100px
 * the right rail is replaced by `tocInline`, rendered by the caller inside
 * the article where it reads best.
 */
export function KbDocsLayout({
  nav,
  drawerNav,
  toc,
  children,
  tone = "portal",
  drawerLabel = "Browse articles",
  resetKey,
}: {
  nav: ReactNode;
  /** The tree again for the narrow-width toggle (separate instance, unique ids). */
  drawerNav: ReactNode;
  toc?: ReactNode;
  children: ReactNode;
  tone?: "portal" | "paper";
  drawerLabel?: string;
  /** Closes the toggle when this changes (e.g. the article number). */
  resetKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [resetKey]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>("a[aria-current='page']") ?? panel?.querySelector<HTMLElement>("a, button"))?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={cn("kbd", tone === "portal" ? "kbd-tone-portal" : "kbd-tone-paper")}>
      <div className="kbd-grid">
        <aside className="kbd-nav-col" aria-label="Knowledge base navigation">
          <div className="kbd-sticky">{nav}</div>
        </aside>
        <div className="kbd-center">
          <div className="kbd-drawer-bar">
            <button
              ref={toggleRef}
              type="button"
              className="kbd-drawer-toggle"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((o) => !o)}
              data-kb-drawer-toggle
            >
              <ListTree className="h-4 w-4" aria-hidden="true" />
              {drawerLabel}
              <ChevronDown className="kbd-chevron h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div ref={panelRef} id={panelId} className="kbd-drawer" hidden={!open} data-kb-drawer>
            {drawerNav}
          </div>
          {children}
        </div>
        {toc && (
          <aside className="kbd-toc-col" aria-label="Article outline">
            <div className="kbd-sticky">{toc}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
