import { useScrollSpy } from "./useScrollSpy";
import "./kbDocs.css";

export type KbTocItem = { id: string; text: string; level: 2 | 3 };

/** List of in-page links; the section being read is marked aria-current. */
export function KbTocList({ items, active }: { items: KbTocItem[]; active: string | null }) {
  return (
    <ul>
      {items.map((t) => (
        <li key={t.id}>
          <a href={`#${t.id}`} data-level={t.level} aria-current={active === t.id ? "true" : undefined}>
            {t.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Right-rail "On this page" with scroll-spy. */
export function KbToc({ items, active }: { items: KbTocItem[]; active: string | null }) {
  if (items.length < 2) return null;
  return (
    <nav aria-labelledby="kbd-toc-title" className="kbd-toc" data-kb-toc>
      <p id="kbd-toc-title" className="kbd-toc-title">
        On this page
      </p>
      <KbTocList items={items} active={active} />
    </nav>
  );
}

/** Collapsible "On this page" shown above the body when the right rail has no room. */
export function KbTocInline({ items, active }: { items: KbTocItem[]; active: string | null }) {
  if (items.length < 2) return null;
  return (
    <details className="kbd-toc-inline">
      <summary>On this page</summary>
      <nav aria-label="On this page (inline)" className="kbd-toc">
        <KbTocList items={items} active={active} />
      </nav>
    </details>
  );
}

export { useScrollSpy };
