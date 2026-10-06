import os, textwrap
OUT = __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))

CONCEPTS = {
 "a-neutral-steps": dict(
  title="A. Neutral steps",
  scheme="dark",
  tokens=dict(page="#0c0c0e", rail="#111114", card="#18181c", inset="#0e0e11", hover="#202025", hair="rgba(255,255,255,.07)", hair2="rgba(255,255,255,.12)",
              ink="#f4f4f6", ink2="rgba(244,244,246,.72)", ink3="rgba(244,244,246,.52)",
              pill_bg="#f4f4f6", pill_ink="#111114", accent="#D3126A", accent_ink="#F04C97", accent_on="#ffffff",
              topbar="rgba(12,12,14,.86)"),
  note="Pure neutral greys, the kie.ai ladder one-to-one: page, rail, card each one even step lighter; fields step back down; the selected nav item is the only near-white shape; magenta only on the primary action and one count."),
 "b-graphite-steps": dict(
  title="B. Graphite steps",
  scheme="dark",
  tokens=dict(page="#050312", rail="#0b0915", card="#14111c", inset="#09070f", hover="#1d1927", hair="rgba(255,255,255,.07)", hair2="rgba(255,255,255,.12)",
              ink="#f5f3f7", ink2="rgba(245,243,247,.72)", ink3="rgba(245,243,247,.52)",
              pill_bg="#f5f3f7", pill_ink="#0b0915", accent="#D3126A", accent_ink="#F04C97", accent_on="#ffffff",
              topbar="rgba(5,3,18,.86)"),
  note="Keeps DE's violet-tinted graphite (#050312) so the portal still matches the site, but re-spaces the layers into even steps and adopts the white selected pill and inset fields. Smallest change from what ships today."),
 "c-light-steps": dict(
  title="C. Light steps",
  scheme="light",
  tokens=dict(page="#ecebef", rail="#16141a", card="#ffffff", inset="#f3f2f5", hover="#f7f6f9", hair="rgba(20,16,28,.09)", hair2="rgba(20,16,28,.16)",
              ink="#17141c", ink2="rgba(23,20,28,.72)", ink3="rgba(23,20,28,.55)",
              pill_bg="#ffffff", pill_ink="#16141a", accent="#A30E52", accent_ink="#A30E52", accent_on="#ffffff",
              topbar="rgba(236,235,239,.88)",
              rail_ink="#f4f3f6", rail_ink2="rgba(244,243,246,.7)", rail_ink3="rgba(244,243,246,.5)", rail_hover="#221f27", rail_hair="rgba(255,255,255,.08)", rail_card="#1f1c24"),
  note="The same ladder for the light (Ambient) theme: a graphite rail, a soft grey page, white cards and slightly grey fields. The selected nav item is the white pill on the dark rail; magenta paper-ink is the one accent."),
}

TEMPLATE = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Portal grey ladder: __TITLE__</title>
<link rel="stylesheet" href="../_shared/base.css">
<style>
:root{
  --page:__page__;--rail:__rail__;--card:__card__;--inset:__inset__;--hover:__hover__;--hair:__hair__;--hair-2:__hair2__;
  --ink:__ink__;--ink-2:__ink2__;--ink-3:__ink3__;
  --pill-bg:__pill_bg__;--pill-ink:__pill_ink__;--accent:__accent__;--accent-ink:__accent_ink__;--accent-on:__accent_on__;--topbar:__topbar__;
  --rail-ink:__rail_ink__;--rail-ink-2:__rail_ink2__;--rail-ink-3:__rail_ink3__;--rail-hover:__rail_hover__;--rail-hair:__rail_hair__;--rail-card:__rail_card__;
  __STATE__
  color-scheme:__SCHEME__;
}
body{background:var(--page);color:var(--ink);position:relative}
.example{position:absolute;bottom:12px;right:12px}
.app{display:grid;grid-template-columns:252px 1fr;min-height:100dvh}
/* rail: one step above the page */
.rail{background:var(--rail);border-right:1px solid var(--rail-hair);color:var(--rail-ink)}
.rail-in{position:sticky;top:0;height:100dvh;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:10px;padding:18px 16px 14px}
.mark{width:26px;height:26px;border-radius:7px;background:#E3B23C;display:grid;place-items:center;color:#0b0b0d;font:700 12px "Space Grotesk",sans-serif}
.brand b{font-family:"Space Grotesk",Inter,system-ui,sans-serif;font-size:15px}
.brand small{display:block;font-size:11px;color:var(--rail-ink-3);letter-spacing:.12em;text-transform:uppercase}
.tenant{margin:0 12px 10px;padding:8px 10px;border:1px solid var(--rail-hair);border-radius:9px;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--rail-ink-2);background:var(--rail-card)}
.tenant .dot{width:8px;height:8px;border-radius:50%;background:rgb(var(--ok))}
nav{flex:1;overflow:auto;padding:4px 10px 8px}
.grp{padding:14px 8px 5px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--rail-ink-3)}
.it{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;font-size:14px;color:var(--rail-ink-2);margin:1px 0;white-space:nowrap}
.it svg{width:16px;height:16px;flex:none;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.85}
.it:hover{background:var(--rail-hover);color:var(--rail-ink)}
/* the one near-white shape on the rail */
.it.on{background:var(--pill-bg);color:var(--pill-ink);font-weight:600}
.it.on svg{opacity:1}
.it .n{margin-left:auto;font:600 11px/1.6 Inter;padding:0 7px;border-radius:99px;background:var(--rail-hover);color:var(--rail-ink-2)}
.it .n.hot{background:var(--accent);color:var(--accent-on)}
.it .tag{margin-left:auto;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--rail-ink-3);border:1px solid var(--rail-hair);padding:0 5px;border-radius:4px}
.me{border-top:1px solid var(--rail-hair);padding:12px 16px;display:flex;align-items:center;gap:10px;font-size:13px}
.av{width:30px;height:30px;border-radius:50%;background:var(--rail-card);border:1px solid var(--rail-hair);display:grid;place-items:center;font-weight:600;font-size:12px}
.me small{display:block;color:var(--rail-ink-3);font-size:11px}
.main{min-width:0}
.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:10px 24px;background:var(--topbar);backdrop-filter:blur(8px);border-bottom:1px solid var(--hair)}
.crumb{font-size:13px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.crumb b{color:var(--ink);font-weight:500}
/* fields sit one step below the card they live on */
.cmd{margin-left:auto;display:flex;align-items:center;gap:8px;min-width:260px;padding:8px 10px;border:1px solid var(--hair);border-radius:9px;background:var(--inset);color:var(--ink-3);font-size:13px}
.cmd kbd{margin-left:auto;font:11px Inter;padding:1px 5px;border:1px solid var(--hair-2);border-radius:4px;color:var(--ink-2)}
.icon-btn{width:36px;height:36px;border-radius:9px;border:1px solid var(--hair);background:var(--card);color:var(--ink-2);display:grid;place-items:center;position:relative}
.icon-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round}
.icon-btn .pip{position:absolute;top:7px;right:7px;width:7px;height:7px;border-radius:50%;background:var(--accent)}
.page{padding:24px;max-width:1280px}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:6px}
h1{font-size:28px;font-weight:600}
.sub{color:var(--ink-2);font-size:14px;margin-top:4px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:9px;border:1px solid var(--hair-2);background:var(--card);color:var(--ink);font-size:14px;font-weight:500}
/* the one accent fill on the page */
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-on)}
.verdict{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;padding:16px 18px;border:1px solid rgb(var(--ok)/.35);background:var(--card);border-radius:14px;margin-bottom:16px;box-shadow:inset 3px 0 0 rgb(var(--ok))}
.verdict .ring{width:40px;height:40px;border-radius:50%;border:2.5px solid rgb(var(--ok));display:grid;place-items:center;color:rgb(var(--ok));font-weight:700}
.verdict h2{font-size:16px;font-weight:600}
.verdict p{margin:2px 0 0;color:var(--ink-2);font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.tile{padding:16px;border:1px solid var(--hair);border-radius:14px;background:var(--card)}
.tile .l{font-size:12px;color:var(--ink-3);letter-spacing:.06em;text-transform:uppercase}
.tile .v{font-size:30px;line-height:1.1;margin:8px 0 4px;font-weight:600}
.tile .d{font-size:12px;color:var(--ink-2)}
.grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}
.col{display:grid;gap:16px;align-content:start}
.panel{border:1px solid var(--hair);border-radius:14px;background:var(--card);overflow:hidden}
.panel header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--hair)}
.panel header h3{font-size:14px;font-weight:600}
.panel header a{font-size:13px;color:var(--ink-2)}
.row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--hair);font-size:14px}
.row:hover{background:var(--hover)}
.row:last-child{border-bottom:0}
.row .t{font-weight:500}
.row .m{font-size:12px;color:var(--ink-3);margin-top:2px}
.tok{font-size:11px;letter-spacing:.04em;padding:3px 9px;border-radius:99px;white-space:nowrap}
.tok.open{color:rgb(var(--warn));background:rgb(var(--warn)/.12)}
.tok.prog{color:rgb(var(--info));background:rgb(var(--info)/.12)}
.tok.done{color:rgb(var(--ok));background:rgb(var(--ok)/.12)}
.svc{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--hair);font-size:14px}
.svc:last-child{border-bottom:0}
.svc .ic{width:32px;height:32px;border-radius:9px;background:var(--inset);border:1px solid var(--hair);display:grid;place-items:center}
.svc .ic svg{width:16px;height:16px;stroke:var(--ink-2);fill:none;stroke-width:1.8}
.svc small{display:block;color:var(--ink-3);font-size:12px}
.acts{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 16px}
/* action wells: inset one step below the card */
.act{padding:12px;border:1px solid var(--hair);border-radius:11px;background:var(--inset);font-size:13px}
.act:hover{background:var(--hover)}
.act b{display:block;font-weight:500;margin-bottom:2px}
.act span{color:var(--ink-3);font-size:12px}
.team{display:flex;align-items:center;gap:12px;padding:12px 16px;font-size:14px;border-bottom:1px solid var(--hair)}
.team:last-child{border-bottom:0}
.team .av{background:var(--inset);border-color:var(--hair);color:var(--ink)}
.team small{display:block;color:var(--ink-3);font-size:12px}
.burger{display:none}
@media (max-width:1024px){.tiles{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.cmd{min-width:0;flex:1}}
@media (max-width:767px){.app{grid-template-columns:1fr}.rail{display:none}.top{padding:10px 16px}.page{padding:16px}.cmd{display:none}.burger{display:grid}.verdict{grid-template-columns:auto 1fr}.verdict .btn{grid-column:1/-1;justify-content:center}.acts{grid-template-columns:1fr}.head .btns{width:100%}.head .btns .btn{flex:1;justify-content:center}h1{font-size:24px}}
</style>
</head>
<body>
<span class="example" aria-label="Example data">Example data</span>
<div class="app">
  <aside class="rail" aria-label="Portal navigation"><div class="rail-in">
    <div class="brand"><div class="mark" aria-hidden="true">DE</div><div><b>Digerati Experts</b><small>Client portal</small></div></div>
    <div class="tenant"><span class="dot" aria-hidden="true"></span> Example Dental Group <span style="margin-left:auto;opacity:.5">⌄</span></div>
    <nav>
      <div class="grp">Support</div>
      <a class="it on" href="#">__I_HOME__Dashboard</a>
      <a class="it" href="#">__I_TICKET__Support Tickets <span class="n hot">2</span></a>
      <a class="it" href="#">__I_FORM__Request Forms</a>
      <a class="it" href="#">__I_CHAT__Chats / DE Desk</a>
      <a class="it" href="#">__I_CHECK__Approvals <span class="n">1</span></a>
      <a class="it" href="#">__I_BOOK__Knowledge Base</a>
      <div class="grp">Account</div>
      <a class="it" href="#">__I_BLD__Company</a>
      <a class="it" href="#">__I_CARD__Billing</a>
      <a class="it" href="#">__I_BOX__My Services</a>
      <a class="it" href="#">__I_FILE__Files &amp; Downloads</a>
      <div class="grp">Programs</div>
      <a class="it" href="#">__I_MAP__IT Roadmap <span class="tag">sample</span></a>
      <a class="it" href="#">__I_CHART__Reviews <span class="tag">sample</span></a>
      <div class="grp">Tools</div>
      <a class="it" href="#">__I_GEAR__Settings</a>
    </nav>
    <div class="me"><div class="av">AR</div><div>Alex Rivera<small>Office manager</small></div></div>
  </div></aside>
  <div class="main">
    <header class="top">
      <button class="icon-btn burger" aria-label="Open navigation"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <div class="crumb">Example Dental Group / <b>Dashboard</b></div>
      <div class="cmd" role="button" tabindex="0">Search or jump to… <kbd>⌘K</kbd></div>
      <button class="icon-btn" aria-label="Activity, 1 new"><span class="pip"></span><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/></svg></button>
    </header>
    <main class="page">
      <div class="head">
        <div><div class="eyebrow">Tuesday, 6 October 2026</div><h1>Good morning, Alex</h1><p class="sub">Here is what needs you, and what DE is handling.</p></div>
        <div class="btns" style="display:flex;gap:8px"><a class="btn" href="#">Request access</a><a class="btn primary" href="#">+ New ticket</a></div>
      </div>
      <section class="verdict" aria-label="Status">
        <div class="ring" aria-hidden="true">✓</div>
        <div><h2>Nothing needs you right now.</h2><p>2 tickets are open and DE is working both. No invoices are overdue.</p></div>
        <a class="btn" href="#">View tickets</a>
      </section>
      <section class="tiles" aria-label="Key figures">
        <div class="tile"><div class="l">Open tickets</div><div class="v num">2</div><div class="d">both with DE</div></div>
        <div class="tile"><div class="l">Resolved tickets</div><div class="v num">14</div><div class="d">last 90 days</div></div>
        <div class="tile"><div class="l">Active services</div><div class="v num">5</div><div class="d">see Your services</div></div>
        <div class="tile"><div class="l">Pending invoices</div><div class="v num">1</div><div class="d">due 15 Oct</div></div>
      </section>
      <div class="grid">
        <div class="col">
          <section class="panel" aria-labelledby="rt">
            <header><h3 id="rt">Recent tickets</h3><a href="#">All tickets →</a></header>
            <div class="row"><div><div class="t">Front-desk printer offline</div><div class="m">Hardware · updated 25 min ago</div></div><span class="tok prog">In progress</span></div>
            <div class="row"><div><div class="t">New hire: hygienist account and laptop</div><div class="m">Onboarding · starts Monday</div></div><span class="tok open">Open</span></div>
            <div class="row"><div><div class="t">Shared mailbox rename</div><div class="m">Email · resolved yesterday</div></div><span class="tok done">Resolved</span></div>
          </section>
          <section class="panel" aria-labelledby="ys">
            <header><h3 id="ys">Your services</h3><a href="#">Manage →</a></header>
            <div class="svc"><span class="ic">__I_SHIELD__</span><div>ProActive IT Ecosystem<small>Managed support and security</small></div></div>
            <div class="svc"><span class="ic">__I_CLOUD__</span><div>Backup and recovery<small>Nightly, 30-day retention</small></div></div>
            <div class="svc"><span class="ic">__I_MAIL__</span><div>Microsoft 365 management<small>12 licensed users</small></div></div>
          </section>
        </div>
        <div class="col">
          <section class="panel" aria-labelledby="ds">
            <header><h3 id="ds">Do something</h3></header>
            <div class="acts">
              <a class="act" href="#"><b>Report an outage</b><span>Call first, then a ticket</span></a>
              <a class="act" href="#"><b>Request access or a device</b><span>Accounts, laptops, apps</span></a>
              <a class="act" href="#"><b>Browse the knowledge base</b><span>How-tos and policies</span></a>
              <a class="act" href="#"><b>View or pay an invoice</b><span>Zoho Payments</span></a>
            </div>
          </section>
          <section class="panel" aria-labelledby="tm">
            <header><h3 id="tm">Your account team</h3></header>
            <div class="team"><div class="av">JD</div><div>Account manager<small>Example name · replies within one business day</small></div></div>
            <div class="team"><div class="av">PN</div><div>Lead engineer<small>Example name · on your tickets</small></div></div>
          </section>
        </div>
      </div>
    </main>
  </div>
</div>
</body>
</html>
'''
ICON = lambda d: f'<svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>'
ICONS = {
 "HOME": ICON('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
 "TICKET": ICON('<path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z"/>'),
 "FORM": ICON('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
 "CHAT": ICON('<path d="M4 5h16v11H9l-5 4z"/>'),
 "CHECK": ICON('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
 "BOOK": ICON('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>'),
 "BLD": ICON('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4"/>'),
 "CARD": ICON('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>'),
 "BOX": ICON('<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>'),
 "FILE": ICON('<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>'),
 "MAP": ICON('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
 "CHART": ICON('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
 "GEAR": ICON('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'),
 "SHIELD": ICON('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
 "CLOUD": ICON('<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>'),
 "MAIL": ICON('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
}
STATE_DARK="--ok:52 211 153;--warn:251 191 36;--info:125 211 252;"
STATE_LIGHT="--ok:4 106 77;--warn:146 64 14;--info:21 94 117;"
for slug,c in CONCEPTS.items():
    t=dict(c["tokens"])
    for k in ["rail_ink","rail_ink2","rail_ink3","rail_hover","rail_hair","rail_card"]:
        t.setdefault(k, {"rail_ink":t["ink"],"rail_ink2":t["ink2"],"rail_ink3":t["ink3"],"rail_hover":t["hover"],"rail_hair":t["hair"],"rail_card":t["card"]}[k])
    h=TEMPLATE.replace("__TITLE__",c["title"]).replace("__SCHEME__",c["scheme"]).replace("__STATE__", STATE_LIGHT if c["scheme"]=="light" else STATE_DARK)
    for k,v in t.items(): h=h.replace(f"__{k}__",v)
    for k,v in ICONS.items(): h=h.replace(f"__I_{k}__",v)
    assert "__" not in h.replace("__proto__",""), [x for x in h.split() if "__" in x][:5]
    os.makedirs(f"{OUT}/{slug}",exist_ok=True)
    open(f"{OUT}/{slug}/index.html","w").write(h)
print("ok")
