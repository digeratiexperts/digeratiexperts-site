import { Fragment, type ReactNode } from "react";
import { Link } from "wouter";
import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { DocTable } from "./DocTable";
import { LivePolicyBlock } from "@/components/portal/licensing/LicensePolicyTables";
import { inlineText, parseKbBody, type Block, type Inline } from "@shared/kb";
import { cn } from "@/lib/utils";
import "@/components/kb/docs/kbDocs.css";

/**
 * Renders a knowledge article body (shared/kb.ts dialect) as React elements.
 * Text is never injected as HTML; links were already limited to http(s),
 * mailto and portal paths by the parser. Portal links route in-app; outside
 * links open in a new tab with noopener.
 */

function renderInline(c: Inline[]): ReactNode {
  return c.map((x, i) => {
    switch (x.t) {
      case "text":
        return <Fragment key={i}>{x.v}</Fragment>;
      case "strong":
        return <strong key={i} className="font-semibold text-foreground">{renderInline(x.c)}</strong>;
      case "em":
        return <em key={i}>{renderInline(x.c)}</em>;
      case "code":
        return (
          <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
            {x.v}
          </code>
        );
      case "link":
        return x.href.startsWith("/portal") ? (
          <Link key={i} href={x.href} className="font-medium text-[hsl(var(--primary))] underline-offset-2 hover:underline">
            {renderInline(x.c)}
          </Link>
        ) : (
          <a key={i} href={x.href} target="_blank" rel="noopener noreferrer" className="font-medium text-[hsl(var(--primary))] underline-offset-2 hover:underline">
            {renderInline(x.c)}
          </a>
        );
    }
  });
}

function renderList(b: Extract<Block, { t: "list" }>, depth = 0): ReactNode {
  const Tag = b.ordered ? "ol" : "ul";
  return (
    <Tag className={cn("my-2 space-y-1.5 pl-6", b.ordered ? "list-decimal" : depth ? "list-[circle]" : "list-disc")}>
      {b.items.map((it, i) => (
        <li key={i} className="pl-1 leading-relaxed">
          {renderInline(it.c)}
          {it.children && it.children.t === "list" && renderList(it.children, depth + 1)}
        </li>
      ))}
    </Tag>
  );
}

export function KbBody({ body }: { body: string }) {
  const blocks = parseKbBody(body);
  return (
    <div className="kb-body text-[15px] leading-relaxed text-foreground/90">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h": {
            const cls =
              b.level === 2
                ? "mt-8 mb-2 text-xl font-semibold text-foreground first:mt-0 scroll-mt-24"
                : b.level === 3
                  ? "mt-5 mb-1.5 text-base font-bold text-foreground scroll-mt-24"
                  : "mt-4 mb-1 text-sm font-bold uppercase tracking-wide text-muted-foreground scroll-mt-24";
            const H = (`h${b.level}` as "h2" | "h3" | "h4");
            // h2/h3 carry a "#" anchor (shown on hover and keyboard focus) so a section can be linked.
            return (
              <H key={i} id={b.id} className={cn("kb-heading", cls)}>
                {renderInline(b.c)}
                {b.level < 4 && (
                  <a href={`#${b.id}`} className="kb-anchor" aria-label={`Link to section: ${inlineText(b.c)}`}>
                    #
                  </a>
                )}
              </H>
            );
          }
          case "p":
            return (
              <p key={i} className="my-2">
                {renderInline(b.c)}
              </p>
            );
          case "list":
            return <Fragment key={i}>{renderList(b)}</Fragment>;
          case "table":
            return <DocTable key={i} head={b.head.map(renderInline)} rows={b.rows.map((r) => r.map(renderInline))} />;
          case "note": {
            const Icon = b.tone === "warn" ? AlertTriangle : b.tone === "tip" ? Lightbulb : Info;
            return (
              <div
                key={i}
                role="note"
                aria-label={b.label}
                className={cn(
                  "pt-callout kb-callout my-4 flex gap-3 rounded-lg border px-4 py-3 text-sm",
                  b.tone === "warn" ? "pt-tone-warn" : b.tone === "tip" ? "pt-tone-ok" : "pt-tone-info",
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <span className="kb-callout-label">{b.label}</span>
                  <p>{renderInline(b.c)}</p>
                </div>
              </div>
            );
          }
          case "hr":
            return <hr key={i} className="my-6 border-border" />;
          case "live":
            return (
              <div key={i} className="my-4">
                <LivePolicyBlock />
              </div>
            );
        }
      })}
    </div>
  );
}
