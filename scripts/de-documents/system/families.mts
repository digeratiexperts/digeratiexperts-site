// The three document families. Each composes the same registers in its own
// order, so every DE document shares one system but reads for its purpose.
//
//   Datasheet  spec → brief close.            "What is it, what's in scope, what next."
//   Checklist  editorial → spec → brief close. "Why it matters, check it, act on it."
//   Report     brief → spec → editorial → brief close.
//                                              "Decision first, evidence, limits, next."
//   Policy     spec, numbered clauses → close. "What applies, who it binds, how to ask."
//              (Client Portal agreements; the title box carries version and dates.)
import { aside, type Aside, type Block, type Cta, esc, logo, masthead, md, renderBlocks, type Takeaway, takeaways } from "./components.mts";

export interface Doc {
  slug: string;
  family: "datasheet" | "checklist" | "report" | "policy";
  /** Public path under client/public, e.g. assets/resources/datasheets/x.pdf — never changes. */
  file: string;
  docId: string;
  edition: string;
  title: string; // PDF metadata title
  kicker: string;
  h1: string;
  subtitle: string;
  lede?: string;
  aside?: Aside;
  keywords: string;
  /** Sample content: stamped EXAMPLE on every page. */
  example?: boolean;
  cta: Cta;
  scopeNote?: string;
  /** Report summary page (brief register). */
  brief?: {
    k: string;
    q: string;
    bottomLabel?: string;
    bottom: string;
    bottomDetail?: string;
    kpi?: { label: string; v: string; u?: string }[];
    takeaways: Takeaway[];
    takeawaysTitle?: string;
    toc?: boolean;
  };
  /** Checklist opener (editorial register). */
  opener?: Extract<Block, { t: "editorial" }>;
  blocks: Block[];
}

export interface TocEntry { id: string; n: string; title: string; page?: number }

export function tocEntries(doc: Doc): TocEntry[] {
  let n = 0;
  const out: TocEntry[] = [];
  const walk = (bs: Block[]) =>
    bs.forEach((b) => {
      if (b.t === "section") {
        n += 1;
        const nn = String(n).padStart(2, "0");
        out.push({ id: b.id ?? `s${nn}`, n: nn, title: b.title });
      } else if (b.t === "cols") walk(b.items);
      else if (b.t === "editorial")
        b.sections.forEach((s) => s.id && out.push({ id: s.id, n: "—", title: s.h }));
    });
  walk(doc.blocks);
  return out;
}

function briefPage(doc: Doc, toc: TocEntry[], total?: number) {
  const b = doc.brief!;
  const kpi = b.kpi?.length
    ? `<div class="kpi">${b.kpi.map((k, i) => `${k.label ? `<p class="lbl"${i ? ' style="margin-top:10pt"' : ""}>${esc(k.label)}</p>` : ""}<p class="v"${!k.label && i ? ' style="margin-top:10pt"' : ""}>${esc(k.v)}</p>${k.u ? `<p class="u">${esc(k.u)}</p>` : ""}`).join("")}</div>`
    : "<div></div>";
  const tocHtml = b.toc
    ? `<nav aria-label="Contents"><h2 class="brief-h">Contents</h2><ol class="toc">${toc
        .map((e) => `<li><a href="#${e.id}"><span class="n">${e.n}</span><span>${esc(e.title)}</span><span class="pg">${e.page ? `p. ${e.page}` : ""}</span></a></li>`)
        .join("")}</ol></nav>`
    : "";
  return `<section class="briefpage" aria-label="Summary">
<header class="band"><div class="top">${logo("reverse")}<span class="k">${esc(b.k)}</span></div>
<h1>${esc(doc.h1)}</h1><p class="q">${md(b.q)}</p>${doc.example ? `<p class="stamp">EXAMPLE · NOT CLIENT DATA</p>` : ""}</header>
<div class="brief-body">
<div class="bottomline"><div><p class="eyebrow">${esc(b.bottomLabel ?? "Bottom line")}</p><p class="s">${md(b.bottom)}</p>${b.bottomDetail ? `<p class="i">${md(b.bottomDetail)}</p>` : ""}</div>${kpi}</div>
${takeaways(b.takeaways, b.takeawaysTitle)}
${tocHtml}
</div>
<footer class="brief-foot" aria-hidden="true"><span>DIGERATI EXPERTS · ${esc(doc.docId)} · EDITION ${esc(doc.edition)}</span><span>PAGE 1${total ? ` OF ${total}` : ""}</span></footer>
</section>`;
}

function titleBlock(doc: Doc) {
  return `${masthead(doc)}
<div class="title${doc.aside ? "" : " solo"}"><div><p class="eyebrow">${esc(doc.kicker)}</p><h1>${esc(doc.h1)}</h1><p class="subtitle">${md(doc.subtitle)}</p>${doc.lede ? `<p class="lede">${md(doc.lede)}</p>` : ""}</div>${aside(doc.aside)}</div>`;
}

export function renderDoc(doc: Doc, toc: TocEntry[] = [], total?: number): string {
  const hasRec = JSON.stringify(doc.blocks).includes('"t":"rec"') || JSON.stringify(doc.blocks).includes('"close":true');
  const close = hasRec ? "" : renderBlocks([{ t: "rec" }], doc);
  switch (doc.family) {
    case "datasheet":
    case "policy":
      return `${titleBlock(doc)}\n${renderBlocks(doc.blocks, doc)}\n${close}`;
    case "checklist":
      return `${renderBlocks([doc.opener!], doc)}\n<div class="break" aria-hidden="true"></div>\n${renderBlocks(doc.blocks, doc)}\n${close}`;
    case "report":
      return `${briefPage(doc, toc, total)}\n${renderBlocks(doc.blocks, doc)}\n${close}`;
  }
}
