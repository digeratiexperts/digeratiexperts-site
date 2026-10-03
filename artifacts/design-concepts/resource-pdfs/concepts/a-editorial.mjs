// Concept A — Editorial clarity.
// Hypothesis: a security buyer trusts a document that reads like a considered
// publication. Warm paper, a serif display voice, one text column with a
// marginalia rail, and magenta reduced to a hairline and folio numerals.
import { esc, LOGO, logoFigure } from "../lib/base.mjs";

export const label = "A — Editorial clarity";

const css = `
:root{--paper:#F7F5F2;--ink:#050312;--ink2:#3a3742;--muted:#5d5a66;--rule:#d9d4cc;--mag:#B80F5C;--magBright:#D3126A}
body{font-family:"Inter",sans-serif;color:var(--ink);font-size:9.6pt;line-height:1.5;font-feature-settings:"ss01","cv11"}
.page{background:var(--paper);padding:46pt 54pt 0 54pt}
.mast{display:flex;align-items:center;justify-content:space-between;height:22pt;border-bottom:.6pt solid var(--ink);padding-bottom:8pt}
.mast .logo{height:21pt}
.mast .kicker{font-size:7.4pt;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2)}
.foot{position:absolute;left:54pt;right:54pt;bottom:30pt;display:flex;justify-content:space-between;font-size:7.2pt;color:var(--muted);border-top:.5pt solid var(--rule);padding-top:7pt}
.foot .folio{font-family:"Newsreader",serif;font-size:9pt;color:var(--mag)}
.grid{display:grid;grid-template-columns:118pt 1fr;column-gap:22pt}
.rail{font-size:7.4pt;letter-spacing:.12em;text-transform:uppercase;color:var(--mag);font-weight:600;padding-top:3pt}
h1{font-family:"Newsreader Display",serif;font-weight:400;font-size:58pt;line-height:.98;letter-spacing:-.02em;margin:40pt 0 0}
.eyebrow{font-size:7.6pt;letter-spacing:.16em;text-transform:uppercase;color:var(--ink2);margin-top:26pt}
.stand{font-family:"Newsreader",serif;font-style:italic;font-size:15.5pt;line-height:1.36;color:var(--ink2);margin:16pt 0 0;max-width:420pt}
.intro{margin-top:16pt;max-width:400pt;color:var(--ink2)}
.facts{margin-top:22pt;border-top:.6pt solid var(--ink);display:grid;grid-template-columns:repeat(3,1fr)}
.facts div{padding:10pt 14pt 0 0}
.facts dt{font-size:7.2pt;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600}
.facts dd{font-family:"Newsreader",serif;font-size:11.5pt;line-height:1.32;margin-top:5pt}
.price{font-family:"Newsreader Display",serif;font-size:30pt;line-height:1;letter-spacing:-.01em}
.facts small{font-family:"Inter";font-size:8pt;color:var(--muted);letter-spacing:0;display:block;margin-top:5pt}
.page section{margin-top:20pt}
h2{font-family:"Newsreader",serif;font-weight:500;font-size:17pt;line-height:1.2;margin-bottom:9pt}
.lst li{padding:5.5pt 0;border-bottom:.5pt solid var(--rule);display:grid;grid-template-columns:20pt 1fr}
.lst li:first-child{border-top:.5pt solid var(--rule)}
.lst .n{font-family:"Newsreader",serif;color:var(--mag);font-size:10pt}
.lst b{font-weight:600}
.lst span.d{color:var(--ink2)}
.two{display:grid;grid-template-columns:1fr 1fr;column-gap:22pt}
.ladder{display:grid;grid-template-columns:repeat(4,1fr);border-top:.6pt solid var(--ink);border-bottom:.6pt solid var(--ink)}
.ladder div{padding:10pt 10pt 12pt 0;border-right:.5pt solid var(--rule);padding-left:10pt}
.ladder div:first-child{padding-left:0}
.ladder div:last-child{border-right:0}
.ladder .t{font-size:7.2pt;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600}
.ladder .nm{font-family:"Newsreader",serif;font-size:16pt;margin:3pt 0 2pt}
.ladder .r{font-size:8.4pt;color:var(--ink2)}
.ladder .f{font-size:8pt;margin-top:6pt;color:var(--ink2);line-height:1.42}
.ladder .f b{color:var(--ink);font-weight:600}
.ladder .cur .t{color:var(--mag)}
.ladder .cur .nm{text-decoration:underline;text-decoration-thickness:1.4pt;text-underline-offset:4pt;text-decoration-color:var(--magBright)}
.close{margin-top:20pt;border-top:2pt solid var(--ink);padding-top:12pt;display:grid;grid-template-columns:1fr 150pt;column-gap:22pt}
.close h2{font-size:19pt;margin-bottom:5pt}
.close p{color:var(--ink2);max-width:330pt}
.close .contact{font-size:8.6pt;line-height:1.7}
.close .contact a{text-decoration:none;border-bottom:.6pt solid var(--magBright)}
.note{margin-top:12pt;font-size:7.4pt;color:var(--muted);line-height:1.5;max-width:470pt}
.not li{grid-template-columns:1fr}
`;

const listNum = (items, start = 0) =>
  `<ul class="lst">${items
    .map(
      (it, i) =>
        `<li><span class="n" aria-hidden="true">${String(start + i + 1).padStart(2, "0")}</span><span>${
          typeof it === "string" ? esc(it) : `<b>${esc(it.item)}.</b> <span class="d">${esc(it.detail)}</span>`
        }</span></li>`,
    )
    .join("")}</ul>`;

const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1);

const mast = (c) => `<header class="mast">${logoFigure(LOGO.light)}<span class="kicker">${esc(c.family)} · ${esc(c.titleFull)}</span></header>`;
const foot = (c, n, total) =>
  `<footer class="foot"><span>Digerati Experts · ${esc(c.docId)} · ${esc(c.edition)}</span><span class="folio">${n} / ${total}</span></footer>`;

export function render(c) {
  const p1 = `<section class="page" aria-label="Page 1">
${mast(c)}
<p class="eyebrow">ProActive Ecosystem · Level 1 of 4</p>
<h1>${esc(c.title)}</h1>
<p class="stand">${esc(c.subtitle)}</p>
<p class="intro">${esc(c.intro)}</p>
<dl class="facts">
  <div><dt>${esc(c.facts[0].label)}</dt><dd>${esc(c.facts[0].value)}</dd></div>
  <div><dt>${esc(c.facts[1].label)}</dt><dd>${esc(c.facts[1].value)}</dd></div>
  <div><dt>Published starting point</dt><dd><span class="price">${esc(c.price.rate)}</span><small>${esc(c.price.unit)} · ${esc(c.price.minimum)}</small></dd></div>
</dl>
<div class="two">
<section><h2>What it is for</h2>${listNum(c.purpose)}</section>
<section><h2>Typical deliverables</h2>${listNum(c.deliverables)}</section>
</div>

${foot(c, 1, 2)}
</section>`;

  const p2 = `<section class="page" aria-label="Page 2">
${mast(c)}
<section><h2>What is included</h2>
<div class="two">${listNum(c.included.slice(0, 3))}${listNum(c.included.slice(3), 3)}</div></section>

<section><h2>What is not included at this level</h2>
<ul class="lst not">${c.notIncluded.map((x) => `<li><span><b>${esc(x.item)}.</b> <span class="d">${esc(x.detail)}</span></span></li>`).join("")}</ul></section>
<section><h2>Where ProActive IT sits, and when to move up</h2>
<div class="ladder" role="table" aria-label="The four ProActive levels with published starting rates and monthly minimums">
${c.ladder
  .map(
    (l, i) =>
      `<div role="row" class="${l.current ? "cur" : ""}"><p class="t" role="cell">Level ${i + 1}${l.current ? " · This datasheet" : ""}</p><p class="nm" role="rowheader">${esc(l.name)}</p><p class="r" role="cell">${esc(l.rate)}/user · ${esc(l.min)} min</p><p class="f" role="cell">${l.current ? esc(l.focus) + "." : "<b>Move up when</b> " + esc(lower(c.moveUp[i - 1].when))}</p></div>`,
  )
  .join("")}
</div></section>

<div class="close">
  <div><h2>${esc(c.cta.label)}</h2><p>${esc(c.cta.detail)}</p></div>
  <p class="contact"><a href="${c.cta.url}">${esc(c.cta.urlLabel)}</a><br><a href="${c.cta.phoneHref}">${esc(c.cta.phone)}</a><br><a href="mailto:${c.cta.email}">${esc(c.cta.email)}</a></p>
</div>
<p class="note">${esc(c.scopeNote)}</p>
${foot(c, 2, 2)}
</section>`;
  return { css, body: p1 + p2 };
}
