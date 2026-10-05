#!/usr/bin/env python3
"""Writes index.html from page.html, filling the three rooms with static object
markup. The copy is the Store's own (client/src/data/solutionScenarios.ts and
curatedSolutions.ts); change it there first, then mirror it here.

    python3 build.py              # write index.html
    python3 build.py --publish    # and copy the page to public/scrollcraft/situation-gallery (served noindex at /scrollcraft/situation-gallery/)
"""
import html
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent

FAMILIES = {
    "it_operations": "IT Operations & Support",
    "endpoint_devices": "Endpoint & Device Management",
    "identity_access": "Identity & Access",
    "email_collaboration": "Email & Collaboration",
    "cybersecurity_operations": "Cybersecurity Operations",
    "network_connectivity": "Network & Connectivity",
    "backup_continuity": "Backup & Business Continuity",
    "compliance_risk": "Compliance & Risk Readiness",
    "security_awareness": "Security Awareness & Human Risk",
    "business_communications": "Business Communications",
    "hardware_lifecycle": "Hardware & Lifecycle",
    "documentation_standards": "Documentation & Standards",
    "technology_strategy": "Technology Strategy & Advisory",
}

ARRANGEMENT = {
    "profile": "Your counts decide: Standalone or Co-Managed",
    "standalone": "Standalone suggested",
    "co_managed": "Co-Managed suggested",
}

# id, short index name, image, title, pressure, families, arrangement
ROOMS = [
    ("now", "Something just happened", "Urgent. Call if it is happening right now.", [
        ("phishing-close-call", "Phishing got through", "o10",
         "A phishing or spoofed email got through",
         "Someone clicked, or a client got mail pretending to be us.",
         ["security_awareness", "email_collaboration", "identity_access"], "profile"),
        ("it-person-left", "Our IT person left", "o02",
         "Our only IT person just left",
         "The passwords, the diagrams and the vendor logins walked out with them.",
         ["it_operations", "documentation_standards", "endpoint_devices"], "standalone"),
        ("ransomware-recovery", "Would we recover?", "o04",
         "We don't know if we'd recover from ransomware",
         "There is a backup somewhere; nobody has restored from it.",
         ["backup_continuity", "cybersecurity_operations", "endpoint_devices"], "profile"),
    ]),
    ("change", "We're growing or changing", "New people, new places, new phones.", [
        ("second-location", "A second office", "o05",
         "We're opening a second office",
         "Day one needs internet, phones and working computers, and nobody has done this before.",
         ["network_connectivity", "business_communications", "hardware_lifecycle"], "profile"),
        ("new-hires-fast", "New hires, fast", "o06",
         "New hires need laptops and accounts fast",
         "People start Monday and the last onboarding took two weeks and three vendors.",
         ["hardware_lifecycle", "endpoint_devices", "identity_access"], "profile"),
        ("hybrid-byod", "Own devices at home", "o07",
         "Half the team works from home on their own devices",
         "Company data lives on personal laptops and phones nobody manages.",
         ["endpoint_devices", "identity_access", "email_collaboration"], "profile"),
        ("phone-contract-ending", "Old phone system", "o08",
         "Our phone system is old and the contract is ending",
         "Numbers have to move without dropping a call, and the network has to carry them.",
         ["business_communications", "network_connectivity"], "profile"),
    ]),
    ("prove", "We have to prove it or keep up", "Insurers, auditors and an IT team out of hours.", [
        ("insurance-questionnaire", "Insurance questionnaire", "o03",
         "Cyber-insurance renewal sent a questionnaire we can't answer",
         "The form asks about MFA, backups and evidence, and the answers have to be true.",
         ["compliance_risk", "identity_access", "backup_continuity"], "profile"),
        ("auditor-evidence", "Policies and evidence", "o09",
         "A client or auditor asked for our policies and evidence",
         "A contract or an audit wants documents that do not exist yet.",
         ["compliance_risk", "documentation_standards", "technology_strategy"], "profile"),
        ("internal-it-stretched", "IT team stretched", "o01",
         "Our internal IT team is stretched thin",
         "Tickets pile up, patches slip, and security is whoever has time this week.",
         ["it_operations", "cybersecurity_operations", "endpoint_devices"], "co_managed"),
    ]),
]

e = html.escape


def obj(o, room_key):
    sid, short, img, title, pressure, fams, arr = o
    frame = {
        "now": f'<img src="assets/{img}.webp" width="880" height="1100" alt="" loading="{"eager" if sid == "phishing-close-call" else "lazy"}" decoding="async">',
        "change": f'<div class="obj__tilt" data-sc-tilt="6"><img src="assets/{img}.webp" width="880" height="1100" alt="" loading="lazy" decoding="async"></div>',
        "prove": f'<img class="obj__deep" src="assets/{img}.webp" width="880" height="1100" alt="" loading="lazy" decoding="async" data-sc-parallax="-0.9">',
    }[room_key]
    fam_items = "".join(f"<li>{e(FAMILIES[f])}</li>" for f in fams)
    return f'''
        <article class="obj" id="s-{sid}" data-obj="{sid}" data-short="{e(short)}" data-img="{img}" data-fams="{' '.join(fams)}">
          <figure class="obj__frame">{frame}</figure>
          <div class="obj__label">
            <h3 class="obj__title">{e(title)}</h3>
            <p class="obj__pressure">{e(pressure)}</p>
            <dl class="obj__facts">
              <div><dt>Made of</dt><dd><ul>{fam_items}</ul></dd></div>
              <div><dt>Arrangement</dt><dd>{e(ARRANGEMENT[arr])}</dd></div>
            </dl>
            <button type="button" class="keep" aria-pressed="false" data-keep="{sid}"><span class="keep__box" aria-hidden="true"></span><span class="keep__text">Keep</span><span class="sr-only"> {e(short)}</span></button>
          </div>
        </article>'''


def room_objects(key):
    room = next(r for r in ROOMS if r[0] == key)
    return "".join(obj(o, key) for o in room[3])


def index_nav():
    parts = []
    for key, heading, _line, objs in ROOMS:
        links = "".join(
            f'<li><a href="#s-{o[0]}" data-jump="{o[0]}">{e(o[1])}</a></li>' for o in objs)
        parts.append(f'<li class="index__room"><span class="index__room-name">{e(heading)}</span><ol>{links}</ol></li>')
    return "".join(parts)


def main():
    page = (HERE / "page.html").read_text()
    data = {
        "families": FAMILIES,
        "objects": {o[0]: {"short": o[1], "img": o[2], "fams": o[5], "room": r[0]} for r in ROOMS for o in r[3]},
        "order": [o[0] for r in ROOMS for o in r[3]],
    }
    page = (page
            .replace("<!--@INDEX-->", index_nav())
            .replace("<!--@ROOM:now-->", room_objects("now"))
            .replace("<!--@ROOM:change-->", room_objects("change"))
            .replace("<!--@ROOM:prove-->", room_objects("prove"))
            .replace("/*@DATA*/", "window.SG_DATA = " + json.dumps(data) + ";")
            .replace("<!--@FAMILIES-->", "".join(f"<li>{e(v)}</li>" for v in FAMILIES.values())))
    assert "<!--@" not in page and "/*@" not in page
    assert "—" not in page, "no em dash anywhere visible"
    (HERE / "index.html").write_text(page)
    print("index.html written")
    if "--publish" in sys.argv:
        out = HERE.parents[2] / "public" / "scrollcraft" / "situation-gallery"
        if out.exists():
            shutil.rmtree(out)
        (out / "assets").mkdir(parents=True)
        for name in ("index.html", "scrollcraft.css", "scrollcraft.js"):
            shutil.copy2(HERE / name, out / name)
        for f in (HERE / "assets").iterdir():
            if f.is_file():
                shutil.copy2(f, out / "assets" / f.name)
        print("published to", out.relative_to(HERE.parents[2]))


if __name__ == "__main__":
    main()
