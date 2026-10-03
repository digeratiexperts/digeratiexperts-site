// DE document system — one stylesheet, three registers.
//
//   spec       Technical precision. The default register: numbered sections,
//              spec labels, scope matrices, tables, annotated diagrams.
//   editorial  Warm paper, serif voice. Explanation and orientation: how to
//              use a document, terms, method, limitations.
//   brief      Executive briefing. Decisions: bottom line, takeaways,
//              recommendation. Used for report summaries and every close.
//
// Families compose the registers in their own order (see ../families/*).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FONTS_DIR } from "./paths.mts";

const f = (file: string) => pathToFileURL(path.join(FONTS_DIR, file)).href;

// Static instances only: Chromium embeds variable fonts as Type 3.
const FACES: [string, string, number, string][] = [
  ["Inter", "inter-400", 400, "normal"],
  ["Inter", "inter-500", 500, "normal"],
  ["Inter", "inter-600", 600, "normal"],
  ["Inter", "inter-700", 700, "normal"],
  ["Inter", "inter-italic-400", 400, "italic"],
  ["Space Grotesk", "space-grotesk-500", 500, "normal"],
  ["Space Grotesk", "space-grotesk-600", 600, "normal"],
  ["Newsreader Display", "newsreader-400-o72", 400, "normal"],
  ["Newsreader", "newsreader-400-o16", 400, "normal"],
  ["Newsreader", "newsreader-500-o24", 500, "normal"],
  ["Newsreader", "newsreader-italic-400-o16", 400, "italic"],
  ["Plex Mono", "plex-mono-400", 400, "normal"],
  ["Plex Mono", "plex-mono-500", 500, "normal"],
];

export const TOKENS = {
  ink: "#050312",
  ink2: "#2f2c38",
  muted: "#5b5866",
  rule: "#cfccd6",
  hair: "#e4e2e8",
  tint: "#f4f3f6",
  paper: "#F7F5F2",
  paperRule: "#ddd7ce",
  mag: "#D3126A", // brand magenta: rules, bars, marks only (5.2:1 on white)
  magText: "#B80F5C", // magenta for text (6.4:1 on white, 5.9:1 on paper)
};

const cssString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export interface RunningHead {
  left: string; // e.g. "Datasheet · ProActive IT"
  right: string; // e.g. "DE-DS-PIT · Edition 2026.10"
  stamp?: string; // e.g. "EXAMPLE — not client data"
}

export function stylesheet(head: RunningHead): string {
  const T = TOKENS;
  const faces = FACES.map(
    ([fam, file, w, st]) =>
      `@font-face{font-family:"${fam}";src:url("${f(file + ".ttf")}") format("truetype");font-weight:${w};font-style:${st}}`,
  ).join("\n");
  const marginLabel = `font-family:"Plex Mono";font-size:6.6pt;letter-spacing:.06em;color:${T.muted}`;
  const stamp = head.stamp
    ? `@top-center{content:${cssString(head.stamp)};font-family:"Inter";font-weight:700;font-size:7pt;letter-spacing:.08em;color:${T.magText};text-transform:uppercase}`
    : "";
  return `
${faces}

/* ---------- page model ---------- */
@page{
  size:Letter;
  margin:62pt 50pt 56pt 50pt;
  @top-left{content:${cssString(head.left.toUpperCase())};${marginLabel};vertical-align:bottom;padding-bottom:12pt}
  @top-right{content:${cssString(head.right.toUpperCase())};${marginLabel};vertical-align:bottom;padding-bottom:12pt}
  ${stamp}
  @bottom-left{content:"DIGERATI EXPERTS · DIGERATIEXPERTS.COM";${marginLabel};vertical-align:top;padding-top:14pt}
  @bottom-right{content:"PAGE " counter(page) " OF " counter(pages);${marginLabel};vertical-align:top;padding-top:14pt}
}
@page:first{
  margin-top:36pt;
  @top-left{content:none} @top-right{content:none} @top-center{content:none}
}
@page editorial{
  background:${T.paper};
}
@page brief{
  margin:0;
  @top-left{content:none} @top-right{content:none} @top-center{content:none}
  @bottom-left{content:none} @bottom-right{content:none}
}

*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Inter",sans-serif;font-size:9.2pt;line-height:1.48;color:${T.ink};font-feature-settings:"tnum" 0,"cv11"}
a{color:inherit;text-decoration:none}
ul,ol{list-style:none}
b,strong{font-weight:600}
svg{display:block}
img.logo{display:block;width:auto}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* keep-togethers and orphan control */
h1,h2,h3,h4{break-after:avoid;page-break-after:avoid}
p,li{orphans:3;widows:3}
.keep,tr,figure,.check,.callout,.rec,.ladder-fig,.flow,.panel,.tick,.num,.cols > .sec{break-inside:avoid;page-break-inside:avoid}
.sec-head{break-after:avoid}
.break{break-before:page}

/* ---------- shared atoms ---------- */
.lbl{font-family:"Plex Mono";font-size:6.9pt;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};font-weight:400}
.eyebrow{font-size:7.2pt;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:${T.magText}}
.muted{color:${T.muted}}
.d{color:${T.ink2}}
.link{border-bottom:.7pt solid ${T.mag}}
.mono{font-family:"Plex Mono"}

/* masthead (page 1, in flow) */
.masthead{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.2pt solid ${T.ink};padding-bottom:9pt}
.masthead .logo{height:22pt}
.spec{display:flex;border:.6pt solid ${T.rule};border-bottom:0}
.spec div{padding:3pt 8pt;border-left:.6pt solid ${T.rule};font-family:"Plex Mono";font-size:6.4pt;letter-spacing:.05em;color:${T.muted}}
.spec div:first-child{border-left:0}
.spec b{display:block;color:${T.ink};font-weight:500;font-size:7.3pt;letter-spacing:.02em}

/* title block */
.title{display:grid;grid-template-columns:1fr 172pt;column-gap:24pt;margin-top:13pt;align-items:start}
.title.solo{grid-template-columns:1fr}
h1{font-family:"Space Grotesk";font-weight:600;font-size:31pt;line-height:1.02;letter-spacing:-.025em;margin-top:5pt}
.subtitle{font-size:10.6pt;line-height:1.4;margin-top:7pt}
.lede{color:${T.ink2};margin-top:7pt}
.aside .box{border:1.2pt solid ${T.ink};padding:10pt 12pt}
.aside .v{font-family:"Space Grotesk";font-weight:600;font-size:28pt;letter-spacing:-.02em;line-height:1;margin-top:4pt}
.aside .u{font-size:8pt;color:${T.ink2};margin-top:3pt}
.aside .m{margin-top:8pt;padding-top:7pt;border-top:.6pt solid ${T.rule};font-size:8pt}
.aside .m b{font-family:"Space Grotesk";font-weight:600;font-size:12pt}
.facts div{padding:6pt 0;border-bottom:.6pt solid ${T.rule}}
.facts dd{margin-top:2pt;font-size:8.6pt;line-height:1.4}
.aside .box + .facts{margin-top:8pt}

/* ---------- spec register ---------- */
.sec{margin-top:12pt}
.sec-head{display:flex;gap:9pt;align-items:baseline;border-top:.8pt solid ${T.ink};padding-top:7pt;margin-bottom:8pt}
.sec-head .no{font-family:"Plex Mono";font-weight:500;font-size:7.8pt;color:${T.magText}}
h2{font-family:"Space Grotesk";font-weight:600;font-size:12.5pt;letter-spacing:-.005em;line-height:1.2}
h3{font-family:"Space Grotesk";font-weight:600;font-size:10pt;margin:10pt 0 4pt}
.intro{color:${T.ink2};max-width:480pt;margin-bottom:8pt}
.cols{display:grid;grid-template-columns:1fr 1fr;column-gap:24pt}
.cols > .sec{margin-top:12pt}
.tick li{padding:2.8pt 0 2.8pt 14pt;position:relative;border-bottom:.5pt solid ${T.hair}}
.tick li::before{content:"";position:absolute;left:0;top:8.2pt;width:6pt;height:1.1pt;background:${T.ink}}
.num li{padding:3pt 0;border-bottom:.5pt solid ${T.hair};display:grid;grid-template-columns:18pt 1fr}
.num .n{font-family:"Plex Mono";font-size:7.4pt;color:${T.magText};padding-top:1.2pt}
table{width:100%;border-collapse:collapse;font-size:8.5pt;line-height:1.42}
caption{caption-side:bottom;text-align:left;font-size:7.4pt;color:${T.muted};padding-top:5pt}
th{text-align:left;vertical-align:top}
thead th{font-family:"Plex Mono";font-weight:500;font-size:6.7pt;letter-spacing:.06em;text-transform:uppercase;color:${T.muted};padding:0 8pt 5pt 0;border-bottom:1pt solid ${T.ink}}
tbody th{font-weight:600;padding:4.5pt 8pt 4.5pt 0;border-bottom:.5pt solid ${T.rule}}
td{padding:4.5pt 8pt 4.5pt 0;border-bottom:.5pt solid ${T.rule};vertical-align:top}
tr.cur td,tr.cur th{background:${T.tint}}
td.st{white-space:nowrap}
.g{display:inline-block;width:7pt;height:7pt;border:1pt solid ${T.ink};border-radius:50%;margin-right:5pt;vertical-align:-.6pt}
.g.in{background:${T.ink}}
.g.add{background:linear-gradient(90deg,${T.ink} 50%,transparent 50%)}
.legend{display:flex;gap:14pt;font-size:7.4pt;color:${T.muted};margin-top:5pt}
figure{margin-top:2pt}
figcaption{font-size:7.4pt;color:${T.muted};margin-top:6pt;max-width:470pt}
.flow{display:grid;margin-top:2pt}
.flow li{padding-right:10pt}
.flow .n{font-family:"Plex Mono";font-size:6.8pt;color:${T.muted};display:flex;align-items:center;gap:6pt}
.flow .n::after{content:"";flex:1;height:.8pt;background:${T.ink}}
.flow li:last-child .n::after{background:transparent}
.flow b{display:block;font-family:"Space Grotesk";font-weight:600;font-size:9.4pt;margin-top:5pt;line-height:1.25}
.flow span{display:block;color:${T.ink2};font-size:8.1pt;margin-top:2pt}
.callout{border-left:2.4pt solid ${T.ink};padding:7pt 0 7pt 12pt;margin-top:10pt}
.callout .lbl{display:block;margin-bottom:2pt}
.callout.example{border-left-color:${T.mag};background:${T.tint};padding-right:10pt}
.tag{display:inline-block;font-family:"Plex Mono";font-size:6.4pt;letter-spacing:.08em;border:.7pt solid ${T.magText};color:${T.magText};padding:0 3pt;margin-right:4pt;vertical-align:1pt}

/* checklist rows */
.checks{margin-top:4pt}
.check{display:grid;grid-template-columns:24pt 1fr 150pt;column-gap:10pt;padding:7pt 0 6pt;border-bottom:.6pt solid ${T.rule}}
.check .id{font-family:"Plex Mono";font-size:7.4pt;color:${T.magText};padding-top:1.5pt}
.check .q{font-weight:500}
.check .area{display:block;font-family:"Plex Mono";font-size:6.6pt;letter-spacing:.06em;text-transform:uppercase;color:${T.muted};margin-bottom:1pt}
.check .notes{grid-column:2 / 4;margin-top:7pt;height:15pt;border-bottom:.6pt dotted ${T.muted};font-size:6.6pt;color:${T.muted};font-family:"Plex Mono";letter-spacing:.05em}
.boxes{display:flex;gap:9pt;justify-content:flex-end;padding-top:1pt}
.boxes span{display:flex;align-items:center;gap:3.5pt;font-size:7.6pt;color:${T.ink2}}
.boxes i{display:inline-block;width:9pt;height:9pt;border:1pt solid ${T.ink};border-radius:1.5pt}
.group-head{display:flex;justify-content:space-between;align-items:baseline;margin-top:14pt;padding-bottom:4pt;border-bottom:1pt solid ${T.ink}}
.group-head h3{margin:0}
.notes-box{border:.8pt solid ${T.rule};margin-top:8pt;padding:7pt 9pt;height:var(--h,90pt);background:repeating-linear-gradient(to bottom,transparent 0,transparent 17pt,${T.hair} 17pt,${T.hair} 17.6pt)}
.notes-box .lbl{background:#fff;padding-right:4pt}

/* ---------- editorial register ---------- */
.editorial{page:editorial}
.editorial .masthead{border-bottom-color:${T.ink}}
.ed-title{font-family:"Newsreader Display",serif;font-weight:400;font-size:38pt;line-height:1.04;letter-spacing:-.02em;margin-top:18pt}
.ed-stand{font-family:"Newsreader",serif;font-style:italic;font-size:13pt;line-height:1.38;color:${T.ink2};margin-top:9pt;max-width:440pt}
.ed{display:grid;grid-template-columns:110pt 1fr;column-gap:22pt;margin-top:15pt;padding-top:8pt;border-top:.6pt solid ${T.ink}}
.ed .rail,.editorial-inline .rail{font-size:7.2pt;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:${T.magText};padding-top:3pt}
.ed h2{font-family:"Newsreader",serif;font-weight:500;font-size:16pt;margin-bottom:6pt;letter-spacing:0}
.ed p{font-size:9.8pt;line-height:1.56;color:${T.ink2};max-width:400pt}
.ed p + p{margin-top:6pt}
.ed ol.steps{counter-reset:s;margin-top:6pt}
.ed ol.steps li{counter-increment:s;padding:4pt 0 4pt 22pt;position:relative;border-bottom:.5pt solid ${T.paperRule};font-size:9.4pt;max-width:400pt}
.ed ol.steps li::before{content:counter(s);position:absolute;left:0;font-family:"Newsreader",serif;color:${T.magText};font-size:11pt;line-height:1.2}
.ed-fig{margin:6pt 0 2pt;max-width:290pt}
.ed-fig figcaption{margin-top:3pt}
.terms div{padding:4pt 0;border-bottom:.5pt solid ${T.paperRule};display:grid;grid-template-columns:70pt 1fr;column-gap:12pt}
.terms dt{font-family:"Newsreader",serif;font-size:12pt;line-height:1.2}
.terms dd{font-size:9pt;color:${T.ink2}}
.ed-list li{padding:3pt 0 3pt 14pt;position:relative;font-size:9.4pt;color:${T.ink2};max-width:420pt}
.ed-list li::before{content:"";position:absolute;left:0;top:9pt;width:6pt;height:.9pt;background:${T.magText}}

.editorial-inline{background:${T.paper};margin-top:18pt;padding:2pt 16pt 14pt}
.editorial-inline .ed:first-child{border-top:0}
.editorial-inline .rec{background:#fff}

/* ---------- brief register ---------- */
.briefpage{page:brief;height:11in;position:relative;overflow:hidden;break-after:page}
.band{background:${T.ink};color:#fff;padding:34pt 50pt 24pt}
.band .top{display:flex;justify-content:space-between;align-items:center}
.band .logo{height:22pt}
.band .k{font-size:7.2pt;letter-spacing:.08em;text-transform:uppercase;color:#cfccd8}
.band h1{font-size:32pt;margin-top:22pt;color:#fff}
.band .q{font-size:11pt;color:#e6e4ea;margin-top:9pt;max-width:440pt}
.band .q b{color:#fff}
.band .stamp{display:inline-block;margin-top:14pt;border:1pt solid #fff;padding:2pt 7pt;font-size:7.4pt;font-weight:700;letter-spacing:.08em}
.brief-body{padding:18pt 50pt 0}
.bottomline{display:grid;grid-template-columns:1fr 150pt;column-gap:24pt;align-items:start}
.bottomline .s{font-family:"Space Grotesk";font-weight:500;font-size:12.6pt;line-height:1.34;margin-top:5pt}
.bottomline .i{color:${T.ink2};margin-top:7pt}
.kpi{border-left:2pt solid ${T.ink};padding-left:12pt}
.kpi .v{font-family:"Space Grotesk";font-weight:600;font-size:22pt;letter-spacing:-.015em;line-height:1.05;margin-top:4pt}
.kpi .u{font-size:8pt;color:${T.ink2};margin-top:3pt}
.take{display:grid;column-gap:16pt;border-top:1.4pt solid ${T.ink};margin-top:6pt}
.take li{padding-top:8pt}
.take .n{font-family:"Space Grotesk";font-weight:600;font-size:18pt;color:${T.magText};line-height:1}
.take b{display:block;font-size:9.6pt;margin-top:5pt;line-height:1.3}
.take span{display:block;color:${T.ink2};margin-top:3pt;font-size:8.6pt}
.brief-h{font-family:"Space Grotesk";font-weight:600;font-size:12.5pt;margin:16pt 0 7pt}
.toc li a{display:grid;grid-template-columns:22pt 1fr auto;padding:4pt 0;border-bottom:.6pt solid ${T.rule};font-size:9pt}
.toc .n{font-family:"Plex Mono";font-size:7.4pt;color:${T.magText};padding-top:1pt}
.toc .pg{font-family:"Plex Mono";font-size:7.4pt;color:${T.muted}}
.brief-foot{position:absolute;left:50pt;right:50pt;bottom:26pt;display:flex;justify-content:space-between;${marginLabel};border-top:.6pt solid ${T.rule};padding-top:6pt}

/* recommendation / close — brief register, used by every family */
.rec{display:grid;grid-template-columns:4pt 1fr;background:${T.paper};margin-top:14pt}
.editorial .rec{background:#fff}
.rec .bar{background:${T.mag}}
.rec .in{padding:10pt 15pt 11pt}
.rec h2{font-family:"Space Grotesk";font-size:15pt;margin:3pt 0 4pt}
.rec p{color:${T.ink2};max-width:440pt}
.rec .ct{margin-top:9pt;display:flex;flex-wrap:wrap;gap:4pt 16pt;font-weight:600;font-size:8.8pt}
.scope-note{margin-top:10pt;padding-top:7pt;border-top:.6pt solid ${T.paperRule};font-size:7.2pt;line-height:1.5;color:${T.muted};max-width:500pt}
`;
}
