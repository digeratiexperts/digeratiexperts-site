// Concept C — Executive briefing.
// Hypothesis: the reader is an owner or executive deciding, not studying. Lead
// with the decision and three takeaways, show fit as a side-by-side check,
// compare the four levels in one table, close on a written recommendation.
// One graphite band carries the identity; everything else is white and calm.
import { esc, LOGO, logoFigure } from "../lib/base.mjs";

export const label = "C — Executive briefing";

const css = `
:root{--ink:#050312;--ink2:#34313d;--muted:#5d5a66;--rule:#d6d3dc;--tint:#f5f4f7;--paper:#F7F5F2;--mag:#D3126A;--magText:#B80F5C}
body{font-family:"Inter",sans-serif;color:var(--ink);font-size:9.3pt;line-height:1.48;background:#fff}
.page{background:#fff}
.band{background:var(--ink);color:#fff;padding:30pt 50pt 22pt}
.band .top{display:flex;justify-content:space-between;align-items:center}
.band .logo{height:22pt}
.band .k{font-size:7.4pt;letter-spacing:.16em;text-transform:uppercase;color:#c9c6d1}
.band h1{font-family:"Space Grotesk";font-weight:600;font-size:38pt;letter-spacing:-.025em;line-height:1;margin-top:20pt}
.band .q{font-size:11.5pt;color:#e6e4ea;margin-top:9pt;max-width:440pt}
.band .q b{color:#fff;font-weight:600}
.body{padding:20pt 50pt 0}
.lead{display:grid;grid-template-columns:1fr 150pt;column-gap:26pt;align-items:start}
.bl{font-size:7.4pt;letter-spacing:.14em;text-transform:uppercase;color:var(--magText);font-weight:700}
.lead p.s{font-family:"Space Grotesk";font-weight:500;font-size:12.6pt;line-height:1.32;letter-spacing:-.005em;margin-top:6pt}
.lead p.i{color:var(--ink2);margin-top:8pt}
.num{border-left:2pt solid var(--ink);padding-left:12pt}
.num .v{font-family:"Space Grotesk";font-weight:600;font-size:34pt;letter-spacing:-.02em;line-height:1}
.num .u{font-size:8.4pt;color:var(--ink2);margin-top:3pt}
.num .m{font-family:"Space Grotesk";font-weight:600;font-size:15pt;margin-top:10pt;line-height:1}
h2{font-family:"Space Grotesk";font-weight:600;font-size:13.5pt;letter-spacing:-.01em;margin-bottom:8pt}
.page section.blk{margin-top:16pt}
.p2{font-size:8.8pt}
.p2 section.blk{margin-top:13pt}
.p2 h2{font-size:12.5pt;margin-bottom:6pt}
.take{display:grid;grid-template-columns:repeat(3,1fr);column-gap:16pt;border-top:1.4pt solid var(--ink)}
.take li{padding-top:9pt}
.take .n{font-family:"Space Grotesk";font-weight:600;font-size:20pt;color:var(--magText);line-height:1}
.take b{display:block;font-weight:600;font-size:9.8pt;margin-top:6pt;line-height:1.3}
.take span{display:block;color:var(--ink2);margin-top:3pt;font-size:8.6pt}
.fit{display:grid;grid-template-columns:1fr 1fr;border:1pt solid var(--ink)}
.fit > div{padding:10pt 13pt}
.fit > div + div{border-left:1pt solid var(--ink);background:var(--tint)}
.fit h3{font-family:"Space Grotesk";font-weight:600;font-size:10.5pt;margin-bottom:6pt}
.fit li{padding:1.8pt 0 1.8pt 13pt;position:relative}
.fit li::before{content:"";position:absolute;left:0;top:8.2pt;width:7pt;height:1pt;background:var(--ink2)}
.foot{position:absolute;left:50pt;right:50pt;bottom:26pt;display:flex;justify-content:space-between;font-size:7.2pt;color:var(--muted);border-top:.6pt solid var(--rule);padding-top:7pt}
.p2 .body{padding-top:30pt}
.hdr2{display:flex;justify-content:space-between;align-items:center;border-bottom:1.4pt solid var(--ink);padding-bottom:9pt}
.hdr2 .logo{height:19pt}
.hdr2 span{font-size:7.4pt;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.gets{display:grid;grid-template-columns:1.25fr 1fr;column-gap:22pt}
.gets li{padding:2pt 0;border-bottom:.6pt solid var(--rule);display:grid;grid-template-columns:16pt 1fr}
.gets .y,.gets .x{padding-top:3pt}
.gets b{font-weight:600}
.gets span.d{color:var(--ink2)}
table{width:100%;border-collapse:collapse;font-size:8.2pt;table-layout:fixed}
th,td{text-align:left;vertical-align:top;padding:4pt 8pt 4pt 0;border-bottom:.6pt solid var(--rule)}
thead th{font-family:"Space Grotesk";font-weight:600;font-size:10pt;border-bottom:1.4pt solid var(--ink);padding-bottom:6pt}
thead th small{display:block;font-family:"Inter";font-weight:600;font-size:6.6pt;letter-spacing:.12em;text-transform:uppercase;color:var(--magText);margin-bottom:2pt}
tbody th{font-weight:600;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
col.h{width:70pt}
td.cur,th.cur{background:var(--tint);padding-left:7pt}
.dl{display:flex;flex-wrap:wrap;gap:4pt 6pt}
.dl li{border:.8pt solid var(--rule);padding:1.5pt 7pt;font-size:8.2pt}
.rec{margin-top:13pt;display:grid;grid-template-columns:4pt 1fr;background:var(--paper)}
.rec .bar{background:var(--mag)}
.rec .in{padding:10pt 14pt}
.rec h2{font-size:15pt;margin:3pt 0 3pt}
.rec p{color:var(--ink2)}
.rec ol{display:grid;grid-template-columns:repeat(4,1fr);column-gap:10pt;margin-top:10pt;counter-reset:s}
.rec ol li{font-size:8.2pt;border-top:1pt solid var(--ink);padding-top:5pt;counter-increment:s}
.rec ol li b{display:block;font-weight:600}
.rec ol li b::before{content:counter(s) ". "}
.rec .ct{margin-top:8pt;font-weight:600;font-size:9pt}
.rec .ct a{text-decoration:none;border-bottom:.8pt solid var(--mag);margin-right:14pt}
.note{margin-top:10pt;font-size:7.3pt;color:var(--muted)}
`;

const foot = (c, n) =>
  `<footer class="foot"><span>Digerati Experts · ${esc(c.titleFull)} briefing · ${esc(c.edition)}</span><span>Page ${n} of 2</span></footer>`;

export function render(c) {
  const p1 = `<section class="page" aria-label="Page 1">
<header class="band">
  <div class="top">${logoFigure(LOGO.reverse)}<span class="k">Executive briefing · Datasheet</span></div>
  <h1>${esc(c.title)}</h1>
  <p class="q"><b>The decision:</b> is ProActive IT the right starting level for your business, and when would you move beyond it?</p>
</header>
<div class="body">
<div class="lead">
  <div><p class="bl">Bottom line</p><p class="s">${esc(c.subtitle)}</p><p class="i">${esc(c.intro)}</p></div>
  <div class="num" aria-label="Published starting point"><p class="bl">Starting point</p><p class="v">${esc(c.price.rate)}</p><p class="u">${esc(c.price.unit)}</p><p class="m">$1,600</p><p class="u">monthly minimum</p></div>
</div>
<section class="blk"><h2>Three things to know</h2>
<ol class="take">
<li><span class="n" aria-hidden="true">1</span><b>Security is included from day one.</b><span>The DE Security Foundation and a managed endpoint, identity, email and monitoring baseline are part of ProActive IT.</span></li>
<li><span class="n" aria-hidden="true">2</span><b>Backup and 24/7 detection start one level up.</b><span>Endpoint backup and 24/7 managed detection and response begin in ProActive Office.</span></li>
<li><span class="n" aria-hidden="true">3</span><b>The assessment sets the scope.</b><span>Published rates are starting points; your Cyber Risk Assessment confirms the right level and final pricing.</span></li>
</ol></section>
<section class="blk"><h2>Fit check</h2>
<div class="fit">
  <div><h3>ProActive IT fits when you want to</h3><ul>${c.purpose.map((x) => `<li>${esc(x)}</li>`).join("")}<li>${esc(c.facts[0].value)}</li></ul></div>
  <div><h3>Look at ProActive Office when</h3><ul><li>Onboarding and productivity platforms need to be managed for you.</li><li>The office network should be professionally managed.</li><li>Endpoint backup should be included, not added.</li><li>24/7 managed detection and response becomes important.</li></ul></div>
</div></section>
</div>
${foot(c, 1)}
</section>`;

  const p2 = `<section class="page p2" aria-label="Page 2">
<div class="body">
<header class="hdr2">${logoFigure(LOGO.light)}<span>${esc(c.titleFull)} · Executive briefing</span></header>
<section class="blk"><div class="gets">
  <div><h2>What you get</h2><ul>${c.included.map((x) => `<li><span class="y" aria-hidden="true"><svg viewBox="0 0 10 10" width="8" height="8"><path d="M1.5 5.2 4 7.6 8.6 2.4" fill="none" stroke="#050312" stroke-width="1.6"/></svg></span><span><b>${esc(x.item)}.</b> <span class="d">${esc(x.detail)}</span></span></li>`).join("")}</ul></div>
  <div><h2>What you do not get at this level</h2><ul>${c.notIncluded.map((x) => `<li><span class="x" aria-hidden="true"><svg viewBox="0 0 10 10" width="8" height="8"><path d="M2 2 8 8M8 2 2 8" fill="none" stroke="#050312" stroke-width="1.6"/></svg></span><span><b>${esc(x.item)}.</b> <span class="d">${esc(x.detail)}</span></span></li>`).join("")}</ul></div>
</div></section>
<section class="blk"><h2>The four levels side by side</h2>
<table><colgroup><col class="h"><col><col><col><col></colgroup><thead><tr><td></td>${c.ladder.map((l) => `<th scope="col" class="${l.current ? "cur" : ""}">${l.current ? "<small>This briefing</small>" : ""}${esc(l.name)}</th>`).join("")}</tr></thead>
<tbody>
<tr><th scope="row">Rate</th>${c.ladder.map((l) => `<td class="${l.current ? "cur" : ""}">${esc(l.rate)} per user / month</td>`).join("")}</tr>
<tr><th scope="row">Minimum</th>${c.ladder.map((l) => `<td class="${l.current ? "cur" : ""}">${esc(l.min)} / month</td>`).join("")}</tr>
<tr><th scope="row">Focus</th>${c.ladder.map((l) => `<td class="${l.current ? "cur" : ""}">${esc(l.focus)}</td>`).join("")}</tr>
<tr><th scope="row">Move up when</th>${c.ladder.map((l, i) => `<td class="${l.current ? "cur" : ""}">${i === 0 ? "Starting level" : esc(c.moveUp[i - 1].when)}</td>`).join("")}</tr>
</tbody></table></section>
<section class="blk"><h2>What leadership receives</h2><ul class="dl">${c.deliverables.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></section>
<div class="rec"><div class="bar" aria-hidden="true"></div><div class="in">
<p class="bl">Recommendation</p><h2>${esc(c.cta.label)}</h2><p>${esc(c.cta.detail)}</p>

<p class="ct"><a href="${c.cta.url}">${esc(c.cta.urlLabel)}</a><a href="${c.cta.phoneHref}">${esc(c.cta.phone)}</a><a href="mailto:${c.cta.email}">${esc(c.cta.email)}</a></p>
</div></div>
<p class="note">${esc(c.scopeNote)}</p>
</div>
${foot(c, 2)}
</section>`;
  return { css, body: p1 + p2 };
}
