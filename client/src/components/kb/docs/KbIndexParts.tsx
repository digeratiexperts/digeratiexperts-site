import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import "./kbDocs.css";

/** Wraps help-centre pieces in a tone so the shared styles resolve. */
export function KbToneScope({ tone, className, children }: { tone: "portal" | "paper"; className?: string; children: ReactNode }) {
  return <div className={cn(tone === "portal" ? "kbd-tone-portal" : "kbd-tone-paper", className)}>{children}</div>;
}

export function KbSearchField({
  id,
  value,
  onChange,
  label,
  placeholder,
  testId,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  testId?: string;
}) {
  return (
    <div className="kbd-search" role="search">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden="true" />
      <input id={id} type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} autoComplete="off" />
    </div>
  );
}

export function KbHelpHero({ eyebrow, title, lede, children }: { eyebrow?: string; title: string; lede?: string; children?: ReactNode }) {
  return (
    <header className="kbd-hero">
      {eyebrow && <p className="kbd-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {lede && <p>{lede}</p>}
      {children}
    </header>
  );
}

export function KbCardGrid({ cols = 3, children, label }: { cols?: 3 | 4; children: ReactNode; label?: string }) {
  return (
    <ul className="kbd-cards" data-cols={cols} aria-label={label}>
      {children}
    </ul>
  );
}

type CardBody = {
  icon?: LucideIcon;
  title: string;
  sub?: string;
  text?: string;
  items?: string[];
  cta?: string;
};

function CardInner({ icon: Icon, title, sub, text, items, cta }: CardBody) {
  return (
    <>
      <span className="kbd-card-head">
        {Icon && (
          <span className="kbd-card-icon" aria-hidden="true">
            <Icon />
          </span>
        )}
        <span>
          <span className="kbd-card-title block">{title}</span>
          {sub && <span className="kbd-card-sub block">{sub}</span>}
        </span>
      </span>
      {text && <span className="kbd-card-text block">{text}</span>}
      {items && items.length > 0 && (
        <ul className="kbd-card-list">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {cta && (
        <span className="kbd-card-cta">
          {cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </>
  );
}

/**
 * One help-centre card. With `href` it is a link (in-app paths route through
 * wouter, absolute URLs are plain anchors); with `onSelect` a button; with
 * neither a static panel.
 */
export function KbCard({ href, onSelect, testId, ...body }: CardBody & { href?: string; onSelect?: () => void; testId?: string }) {
  let inner: ReactNode;
  if (href && /^https?:/.test(href)) {
    inner = (
      <a href={href} className="kbd-card" data-testid={testId}>
        <CardInner {...body} />
      </a>
    );
  } else if (href) {
    inner = (
      <Link href={href} className="kbd-card" data-testid={testId}>
        <CardInner {...body} />
      </Link>
    );
  } else if (onSelect) {
    inner = (
      <button type="button" className="kbd-card" onClick={onSelect} data-testid={testId}>
        <CardInner {...body} />
      </button>
    );
  } else {
    inner = (
      <div className="kbd-card" data-testid={testId}>
        <CardInner {...body} />
      </div>
    );
  }
  return <li className="flex">{inner}</li>;
}

export function KbStillHaveQuestions({ title = "Still have questions?", text, action }: { title?: string; text: string; action: ReactNode }) {
  return (
    <section className="kbd-still" aria-labelledby="kbd-still-title">
      <div>
        <h2 id="kbd-still-title">{title}</h2>
        <p>{text}</p>
      </div>
      {action}
    </section>
  );
}
