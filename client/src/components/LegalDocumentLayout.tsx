import { useEffect, useRef, useState } from "react";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { Chapter, Container, Eyebrow } from "@/components/site/chapters";

type LegalDocumentLayoutProps = {
  title: string;
  subtitle?: string;
  description: string;
  canonical: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
};

const LEGAL_DOCS = [
  { label: "Privacy Policy", href: "/legal/privacy-policy" },
  { label: "Terms of Service", href: "/legal/terms-of-use" },
  { label: "Acceptable Use Policy", href: "/legal/aup" },
  { label: "Data Processing Addendum", href: "/legal/dpa" },
  { label: "Master Service Agreement", href: "/legal/msa" },
  { label: "Service Level Agreement", href: "/legal/sla" },
  { label: "Sample Statement of Work", href: "/legal/sample-sow" },
];

type TocEntry = { id: string; label: string };

function slugify(text: string, taken: Set<string>) {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "section";
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

/**
 * Long-form legal reading surface (Trust / legal doctrine, UI-STYLE-RULES §6):
 * quiet hero, then one paper chapter with a ~68ch measure. When a document has
 * many sections an in-page table of contents sticks beside it at lg. The
 * document text itself is never touched; headings only gain anchor ids.
 */
export function LegalDocumentLayout({
  title,
  subtitle,
  description,
  canonical,
  children,
}: LegalDocumentLayoutProps): JSX.Element {
  useSEO({ title, description, canonical });

  const bodyRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TocEntry[]>([]);

  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const taken = new Set<string>();
    const entries: TocEntry[] = [];
    root.querySelectorAll<HTMLHeadingElement>("h2").forEach((h) => {
      const label = (h.textContent ?? "").trim();
      if (!label) return;
      if (!h.id) h.id = slugify(label, taken);
      else taken.add(h.id);
      h.classList.add("scroll-mt-28");
      entries.push({ id: h.id, label });
    });
    setToc(entries);
  }, [children]);

  const showToc = toc.length >= 5;

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Legal"
      title={title}
      subtitle={subtitle}
      breadcrumbs={[{ label: "Legal" }, { label: title }]}
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="order-2 space-y-10 lg:order-1 lg:col-span-3 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
              {showToc && (
                <nav aria-label="On this page" className="hidden lg:block">
                  <Eyebrow tone="paper" className="mb-4">
                    On this page
                  </Eyebrow>
                  <ol className="border-t border-[var(--de-paper-hairline)]">
                    {toc.map((t) => (
                      <li key={t.id} className="border-b border-[var(--de-paper-hairline)]">
                        <a
                          href={`#${t.id}`}
                          className="block py-2.5 text-sm leading-snug text-[#3A3448] transition-colors hover:text-[#A30E52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                        >
                          {t.label}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <nav aria-label="Legal documents">
                <Eyebrow tone="paper" className="mb-4">
                  Legal documents
                </Eyebrow>
                <ul className="border-t border-[var(--de-paper-hairline)]">
                  {LEGAL_DOCS.map((d) => {
                    const current = d.href === canonical;
                    return (
                      <li key={d.href} className="border-b border-[var(--de-paper-hairline)]">
                        <Link
                          href={d.href}
                          aria-current={current ? "page" : undefined}
                          className={`block py-2.5 text-sm leading-snug transition-colors hover:text-[#A30E52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] ${
                            current ? "font-semibold text-[#1A1228]" : "text-[#3A3448]"
                          }`}
                        >
                          {d.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
            <article
              ref={bodyRef}
              data-testid="legal-document"
              className={`order-1 lg:order-2 de-prose-light max-w-[68ch] text-[#3A3448] [&_h2]:font-heading [&_h3]:font-heading lg:col-span-9`}
            >
              {children}
            </article>
          </div>
        </Container>
      </Chapter>
    </PageTemplate>
  );
}
