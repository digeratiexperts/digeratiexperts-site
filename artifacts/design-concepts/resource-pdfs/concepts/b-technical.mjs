// Concept B — Technical precision.
// Hypothesis: a cybersecurity buyer trusts precision they can audit. White
// ground, graphite ink, numbered sections, a spec grid, a scope matrix that
// states included / not included / where it begins, and an annotated diagram.
// Status is always text plus a glyph shape, never colour alone.
import { esc, LOGO, logoFigure } from "../lib/base.mjs";

export const label = "B — Technical precision";

const css = `
:root{--ink:#050312;--ink2:#2f2c38;--muted:#5b5866;--rule:#cfccd6;--hair:#e4e2e8;--tint:#f4f3f6;--mag:#D3126A;--magText:#B80F5C}
body{font-family:"Inter",sans-serif;color:var(--ink);font-size:9pt;line-height:1.46;background:#fff}
.page{background:#fff;padding:36pt 44pt 0}
.mono{font-family:"Plex Mono",monospace}
.hdr{display:grid;grid-template-columns:1fr auto;align-items:end;border-bottom:1.2pt solid var(--ink);padding-bottom:9pt}
.hdr .logo{height:22pt}
.spec{display:grid;grid-template-columns:repeat(4,auto);border:.6pt solid var(--rule);border-bottom:0}
.spec div{padding:3pt 8pt;border-right:.6pt solid var(--rule);font-family:"Plex Mono",monospace;font-size:6.6pt;letter-spacing:.04em;color:var(--muted)}
.spec div:last-child{border-right:0}
.spec b{display:block;color:var(--ink);font-weight:500;font-size:7.4pt;letter-spacing:.02em}
.foot{position:absolute;left:44pt;right:44pt;bottom:24pt;display:flex;justify-content:space-between;font-family:"Plex Mono",monospace;font-size:6.6pt;color:var(--muted);border-top:.6pt solid var(--rule);padding-top:6pt;letter-spacing:.03em}
.lbl{font-family:"Plex Mono",monospace;font-size:7pt;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.title{margin-top:14pt;display:grid;grid-template-columns:1fr 168pt;column-gap:24pt;align-items:start}
h1{font-family:"Space Grotesk",sans-serif;font-weight:600;font-size:40pt;line-height:1;letter-spacing:-.025em;margin-top:6pt}
.sub{font-size:10.8pt;line-height:1.42;color:var(--ink);margin-top:10pt}
.pricebox{border:1.2pt solid var(--ink);padding:10pt 12pt}
.pricebox .v{font-family:"Space Grotesk";font-weight:600;font-size:30pt;letter-spacing:-.02em;line-height:1;margin-top:4pt}
.pricebox .u{font-size:8pt;color:var(--ink2);margin-top:3pt}
.pricebox .m{margin-top:8pt;padding-top:7pt;border-top:.6pt solid var(--rule);font-size:8pt}
.pricebox .m b{font-family:"Space Grotesk";font-weight:600;font-size:12pt}
.intro{margin-top:10pt;color:var(--ink2)}
.facts{margin-top:10pt}
.facts div{padding:6pt 0;border-bottom:.6pt solid var(--rule)}
.facts dd{margin-top:2pt;font-size:8.6pt;line-height:1.4}
h2{font-family:"Space Grotesk",sans-serif;font-weight:600;font-size:12.5pt;letter-spacing:-.005em;display:flex;gap:9pt;align-items:baseline;border-top:.6pt solid var(--ink);padding-top:7pt;margin-bottom:8pt}
h2 .no{font-family:"Plex Mono",monospace;font-weight:500;font-size:8pt;color:var(--magText)}
.page section.blk{margin-top:13pt}
.two{display:grid;grid-template-columns:1fr 1fr;column-gap:24pt}
.two section.blk{margin-top:10pt}
.tick li{padding:2.6pt 0 2.6pt 14pt;position:relative;border-bottom:.5pt solid var(--hair)}
.tick li::before{content:"";position:absolute;left:0;top:8pt;width:6pt;height:1.2pt;background:var(--ink)}
table{width:100%;border-collapse:collapse;font-size:8.4pt}
th{font-family:"Plex Mono",monospace;font-weight:500;font-size:6.8pt;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);text-align:left;padding:0 8pt 5pt 0;border-bottom:1pt solid var(--ink)}
td{padding:3.6pt 8pt 3.6pt 0;border-bottom:.5pt solid var(--rule);vertical-align:top}
td.cap{font-weight:600;width:160pt}
td.st{width:84pt;white-space:nowrap}
.g{display:inline-block;width:7pt;height:7pt;border:1pt solid var(--ink);border-radius:50%;margin-right:5pt;vertical-align:-.5pt}
.g.in{background:var(--ink)}
.g.add{background:linear-gradient(90deg,var(--ink) 50%,transparent 50%)}
.g.out{background:transparent}
tr.out td{color:var(--ink2)}
figure{margin-top:2pt}
figure svg{display:block;width:100%;height:auto}
figcaption{font-size:7.6pt;color:var(--muted);margin-top:5pt}
.flow{display:grid;grid-template-columns:repeat(4,1fr);position:relative;margin-top:4pt}
.flow li{padding:0 10pt 0 0;position:relative}
.flow .n{font-family:"Plex Mono",monospace;font-size:7pt;color:var(--muted);display:flex;align-items:center;gap:6pt}
.flow .n::after{content:"";flex:1;height:.8pt;background:var(--ink)}
.flow li:last-child .n::after{background:transparent}
.flow b{display:block;font-family:"Space Grotesk";font-weight:600;font-size:9.6pt;margin-top:5pt}
.flow span{display:block;color:var(--ink2);font-size:8.2pt;margin-top:2pt}
.cta{margin-top:14pt;border:1.2pt solid var(--ink);display:grid;grid-template-columns:4pt 1fr 160pt}
.cta .bar{background:var(--mag)}
.cta .l{padding:11pt 14pt}
.cta .l h2{border:0;padding:0;margin:3pt 0 3pt;font-size:15pt}
.cta .l p{color:var(--ink2)}
.cta .r{padding:11pt 14pt;border-left:.6pt solid var(--rule);font-family:"Plex Mono",monospace;font-size:7.8pt;line-height:1.85}
.cta a{text-decoration:none;border-bottom:.6pt solid var(--ink)}
.note{margin-top:10pt;font-size:7.2pt;color:var(--muted);line-height:1.5}
`;

const hdr = (c, n) => `<header class="hdr">${logoFigure(LOGO.light)}
<div class="spec" aria-label="Document identification"><div>TYPE<b>${esc(c.family)}</b></div><div>DOC<b>${esc(c.docId)}</b></div><div>REV<b>${esc(c.edition.replace("Edition ", ""))}</b></div><div>PAGE<b>${String(n).padStart(2, "0")} / 02</b></div></div></header>`;
const foot = (c, n) =>
  `<footer class="foot"><span>DIGERATI EXPERTS · ${esc(c.titleFull.toUpperCase())} DATASHEET</span><span>${esc(c.docId)} · ${n}/2</span></footer>`;

// Scope matrix rows: status text always present; glyph shape is a second cue.
const scopeRows = (c) => [
  ...c.included.map((x) => ({ cap: x.item, st: "in", stText: "Included", d: x.detail })),
  { cap: "Endpoint backup", st: "out", stText: "Not included", d: "No default backup program at this level. Begins in ProActive Office." },
  { cap: "24/7 managed detection and response", st: "add", stText: "Scoped add-on", d: "Begins in ProActive Office; added to ProActive IT only by separate scope." },
  { cap: "Compliance reporting", st: "out", stText: "Not included", d: "Audit-grade documentation sits in higher tiers or standalone engagements." },
];

// Annotated ladder diagram. Plain SVG with real <text>, so it stays vector and searchable.
function ladderSvg(c) {
  const W = 524, H = 150, base = 124, colW = 112, gap = 18, x0 = 22;
  const hs = [34, 54, 74, 94];
  const adds = [
    "Baseline: service desk, DE Security Foundation, security monitoring baseline",
    "+ managed network, endpoint backup, 24/7 MDR",
    "+ backup & DR posture, compliance and risk reporting",
    "+ privileged access elements, quarterly executive reviews",
  ];
  let g = `<line x1="${x0}" y1="${base}" x2="${W}" y2="${base}" stroke="#050312" stroke-width="1"/>`;
  c.ladder.forEach((l, i) => {
    const x = x0 + i * (colW + gap), h = hs[i], y = base - h;
    const cur = l.current;
    g += `<rect x="${x}" y="${y}" width="${colW}" height="${h}" fill="${cur ? "#050312" : "#f4f3f6"}" stroke="#050312" stroke-width="${cur ? 0 : 0.8}"/>`;
    g += `<text x="${x + 8}" y="${y + 15}" font-family="Space Grotesk" font-weight="600" font-size="11" fill="${cur ? "#fff" : "#050312"}">${esc(l.name)}</text>`;
    g += `<text x="${x + 8}" y="${y + 27}" font-family="Plex Mono" font-size="7" fill="${cur ? "#e4e2e8" : "#2f2c38"}">${esc(l.rate)}/user · ${esc(l.min)} min</text>`;
    g += `<text x="${x}" y="${base + 12}" font-family="Plex Mono" font-size="6.6" fill="#5b5866">L${i + 1}</text>`;
  });
  // notes rendered as foreignObject-free text blocks above the bars
  const notes = adds.map((t, i) => {
    const x = x0 + i * (colW + gap);
    const y = base - hs[i] - 6;
    const lines = wrap(t, 32);
    return lines.map((ln, j) => `<text x="${x}" y="${y - (lines.length - 1 - j) * 8.6}" font-family="Inter" font-size="6.9" fill="${i === 0 ? "#B80F5C" : "#2f2c38"}">${esc(ln)}</text>`).join("");
  }).join("");
  // y-axis label
  const axis = `<text x="0" y="${base}" font-family="Plex Mono" font-size="6.4" fill="#5b5866" transform="rotate(-90 6 ${base})">OPERATING DEPTH →</text>`;
  const marker = `<text x="${x0}" y="${base + 24}" font-family="Plex Mono" font-size="6.6" fill="#B80F5C">▲ THIS DATASHEET</text>`;
  return `<svg viewBox="0 0 ${W} ${H + 8}" aria-hidden="true">${g}${notes}${axis}${marker}</svg>`;
}
function wrap(t, n) {
  const out = []; let cur = "";
  for (const w of t.split(" ")) { if ((cur + " " + w).trim().length > n) { out.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function render(c) {
  const p1 = `<section class="page" aria-label="Page 1">
${hdr(c, 1)}
<div class="title">
  <div><p class="lbl">ProActive Ecosystem · Level 1 of 4</p><h1>${esc(c.title)}</h1><p class="sub">${esc(c.subtitle)}</p><p class="intro">${esc(c.intro)}</p></div>
  <div><div class="pricebox" aria-label="Published starting point"><p class="lbl">Published starting rate</p><p class="v">${esc(c.price.rate)}</p><p class="u">${esc(c.price.unit)}</p><p class="m"><b>$1,600</b> monthly minimum</p></div>
  <dl class="facts"><div><dt class="lbl">${esc(c.facts[0].label)}</dt><dd>${esc(c.facts[0].value)}</dd></div><div><dt class="lbl">${esc(c.facts[1].label)}</dt><dd>${esc(c.facts[1].value)}</dd></div></dl></div>
</div>
<div class="two">
<section class="blk"><h2><span class="no">01</span>Purpose</h2><ul class="tick">${c.purpose.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>
<section class="blk"><h2><span class="no">02</span>Typical deliverables</h2><ul class="tick">${c.deliverables.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>
</div>
<section class="blk"><h2><span class="no">03</span>Scope at this level</h2>
<table><thead><tr><th scope="col">Capability</th><th scope="col">Status</th><th scope="col">Detail</th></tr></thead><tbody>
${scopeRows(c).map((r) => `<tr class="${r.st === "in" ? "" : "out"}"><td class="cap">${esc(r.cap)}</td><td class="st"><span class="g ${r.st}" aria-hidden="true"></span>${esc(r.stText)}</td><td>${esc(r.d)}</td></tr>`).join("")}
</tbody></table></section>
${foot(c, 1)}
</section>`;

  const p2 = `<section class="page" aria-label="Page 2">
${hdr(c, 2)}
<section class="blk"><h2><span class="no">04</span>Where ProActive IT sits</h2>
<figure role="img" aria-label="Stepped diagram of the four ProActive levels. IT, $125 per user with a $1,600 minimum, is the baseline. Office, $165 and $2,400, adds managed network, endpoint backup and 24/7 managed detection and response. Business, $245 and $5,400, adds backup and DR posture and compliance and risk reporting. Enterprise, $345 and $9,000, adds privileged access elements and quarterly executive reviews.">
${ladderSvg(c)}
<figcaption>Published starting rates per user per month, with monthly minimums. Levels describe operating depth, not a ranking; the Cyber Risk Assessment recommends the fit.</figcaption>
</figure></section>
<section class="blk"><h2><span class="no">05</span>Move-up triggers</h2>
<table><thead><tr><th scope="col">Move to</th><th scope="col">When</th></tr></thead><tbody>
${c.moveUp.map((m) => `<tr><td class="cap">${esc(m.to)}</td><td>${esc(m.when)}</td></tr>`).join("")}
</tbody></table></section>
<section class="blk"><h2><span class="no">06</span>How an engagement starts</h2>
<ol class="flow">${c.engagement.map((e, i) => `<li><span class="n">STEP ${String(i + 1).padStart(2, "0")}</span><b>${esc(e.step)}</b><span>${esc(e.detail)}</span></li>`).join("")}</ol></section>
<div class="cta"><div class="bar" aria-hidden="true"></div>
<div class="l"><p class="lbl">Next action</p><h2>${esc(c.cta.label)}</h2><p>${esc(c.cta.detail)}</p></div>
<p class="r"><a href="${c.cta.url}">${esc(c.cta.urlLabel)}</a><br><a href="${c.cta.phoneHref}">${esc(c.cta.phone)}</a><br><a href="mailto:${c.cta.email}">${esc(c.cta.email)}</a></p></div>
<p class="note">${esc(c.scopeNote)}</p>
${foot(c, 2)}
</section>`;
  return { css, body: p1 + p2 };
}
