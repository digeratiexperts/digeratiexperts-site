/**
 * Homepage B3 sections (Joe approved the B3 preview, 2026-11-13).
 * Markup and copy are the approved preview, section for section; motion lives in useB3Motion.
 * Brand: always "Digerati Experts" or "DE". No prices, clients, stats, testimonials or certifications.
 */
import type { CSSProperties } from "react";
import { FIT_CALL_URL } from "@shared/situationMatch";
import { SituationPicker } from "./SituationPicker";

/** 1 · HERO (bookend: open rings around the Fit Call card) */
export function Hero(): JSX.Element {
  return (
    <section className="hero dark" aria-labelledby="h1">
      <div className="wrap hero__grid">
        <div className="hero__copy">
          <p className="kicker">Managed IT &amp; security · Chandler, Arizona</p>
          <h1 id="h1">Arizona IT that's <span className="ph">locked&nbsp;down</span>, <span className="ph">looked&nbsp;after</span>, and <span className="ph ph--mag">priced in the&nbsp;open.</span></h1>
          <p className="lede">ProActive managed IT and security from Digerati Experts. Assessment first. Prices published. One team that owns the whole thing.</p>
          <div className="hero__actions">
            <a className="btn btn--lg" href={FIT_CALL_URL} target="_blank" rel="noopener" data-testid="button-hero-schedule">Book a Fit Call <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"/></svg></a>
            <a className="textlink textlink--dark" href="#levels">See how coverage works</a>
          </div>
        </div>
        <div className="hero__art">
          <svg className="halo halo--open" viewBox="-100 -100 200 200" aria-hidden="true"></svg>
          <aside className="fitcard" aria-label="What a Fit Call is">
            <div className="fitcard__top"><span className="mono" aria-hidden="true">DE</span><span><b>Digerati Experts</b><small>Booked online with Zoho Bookings</small></span></div>
            <h2 className="fitcard__title">Fit Call</h2>
            <p className="fitcard__meta"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.3 1.5"/></svg>30 minutes</p>
            <ul className="fitcard__list"><li>What you run today</li><li>What worries you</li><li>Whether a ProActive level fits</li></ul>
            <a className="btn btn--block" href={FIT_CALL_URL} target="_blank" rel="noopener">Book a Fit Call</a>
          </aside>
        </div>
      </div>
    </section>
  );
}

/** 2 · THE USUAL WAY (light, not pinned) · B3: a three-card deck that rotates on its own: problem, fix, plan */
export function UsualDeck(): JSX.Element {
  return (
    <section className="usual light sheet" id="usual" aria-labelledby="usual-h">
      <div className="usual__frame">
        <div className="wrap split">
          <div className="split__copy">
            <p className="kicker usual__swap"><span className="usual__hl kicker--warm is-on" data-say="0">The usual way</span><span className="usual__hl kicker--fix" data-say="1">The fix &middot; ProActive Ecosystem</span><span className="usual__hl kicker--fix" data-say="2">The plan &middot; vCIO &amp; compliance</span></p>
            <h2 id="usual-h" className="usual__swap"><span className="usual__hl is-on" data-say="0">Five vendors. Nobody owns&nbsp;it.</span><span className="usual__hl" data-say="1">First login to last. One team owns&nbsp;it.</span><span className="usual__hl" data-say="2">Compliance mapped. Budget planned. No&nbsp;surprises.</span></h2>
            <div className="usual__says">
              <p className="lede usual__say is-on" data-say="0">The Wi-Fi drops and the phone tree starts. Everyone handles their piece. Nobody handles the whole.</p>
              <p className="lede usual__say" data-say="1">So hand the whole thing to <em>one team.</em> Digerati&nbsp;Experts owns every piece, so nobody points at somebody else.</p>
              <p className="lede usual__say" data-say="2">Then someone <em>plans ahead:</em> a roadmap, a budget, and a review every quarter, in plain English.</p>
            </div>
            <div className="deckctl">
              <div className="dots" role="tablist" aria-label="Choose a card">
                <button type="button" role="tab" id="dk-t0" aria-controls="dk-c0" aria-selected="true"><span className="dots__bar" aria-hidden="true"><i></i></span>The problem</button>
                <button type="button" role="tab" id="dk-t1" aria-controls="dk-c1" aria-selected="false" tabIndex={-1}><span className="dots__bar" aria-hidden="true"><i></i></span>The fix</button>
                <button type="button" role="tab" id="dk-t2" aria-controls="dk-c2" aria-selected="false" tabIndex={-1}><span className="dots__bar" aria-hidden="true"><i></i></span>The plan</button>
              </div>
              <button type="button" className="deckctl__pp" id="deckPP" aria-label="Pause the cards"><svg viewBox="0 0 16 16" aria-hidden="true"><path className="i-pause" d="M5.5 3.5v9M10.5 3.5v9"/><path className="i-play" d="M5 3.3v9.4L12.5 8z"/></svg></button>
            </div>
          </div>
          <div className="deck" id="deck" aria-roledescription="carousel" aria-label="The usual way, the fix, and the plan">
            <div className="deck__live" id="deckLive" aria-live="off">
            <div className="callcard is-front" id="dk-c0" role="tabpanel" aria-roledescription="slide" aria-labelledby="dk-t0" data-card="0">
              <p className="note note--usual" aria-hidden="true">Wi-Fi pw:<br />Office2019!</p>
              <div className="callcard__head">
                <b>Who to call</b>
                <span className="tag">Illustration</span>
              </div>
              <ol className="callcard__list">
                <li><span className="av">ISP</span><span className="vn"><b>Internet provider</b><small>"It's not on our end."</small></span><span className="st"><i>?</i></span></li>
                <li><span className="av">CV</span><span className="vn"><b>Copier vendor</b><small>Also does the scanners. Maybe.</small></span><span className="st"><i>?</i></span></li>
                <li><span className="av">LR</span><span className="vn"><b>Licence reseller</b><small>Sold you Microsoft 365 once.</small></span><span className="st"><i>?</i></span></li>
                <li><span className="av">BK</span><span className="vn"><b>Backups</b><small>Nobody's sure who tests them.</small></span><span className="st"><i>?</i></span></li>
                <li><span className="av">N</span><span className="vn"><b>Someone's nephew</b><small>Set up the Wi-Fi in 2019.</small></span><span className="st"><i>?</i></span></li>
              </ol>
              <div className="callcard__foot" aria-hidden="true"><div className="meter"><span style={{ "--m": 1 } as CSSProperties}></span></div><span className="callcard__count">5 of 5 tried</span></div>
            </div>
            <div className="callcard callcard--fix" id="dk-c1" role="tabpanel" aria-roledescription="slide" aria-labelledby="dk-t1" data-card="1">
              <p className="note note--vault" aria-hidden="true">Passwords:<br />in the vault.</p>
              <div className="callcard__head">
                <b>One team owns it</b>
                <span className="tag">ProActive Ecosystem</span>
              </div>
              <ol className="callcard__list">
              <li><span className="av">EP</span><span className="vn"><b>Endpoints &amp; network</b><small>Patched and monitored before you notice.</small></span><span className="st"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.5 5"/></svg></i></span></li>
              <li><span className="av">ID</span><span className="vn"><b>Identity &amp; access</b><small>MFA, single sign-on, access by role.</small></span><span className="st"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.5 5"/></svg></i></span></li>
              <li><span className="av">OB</span><span className="vn"><b>On- and offboarding</b><small>Ready on day one. Locked out on the last.</small></span><span className="st"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.5 5"/></svg></i></span></li>
              <li><span className="av">SL</span><span className="vn"><b>Security levels</b><small>Protection matched to each user&rsquo;s risk.</small></span><span className="st"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.5 5"/></svg></i></span></li>
              <li><span className="av">BK</span><span className="vn"><b>Backup &amp; recovery</b><small>Restores we test, not hope for.</small></span><span className="st"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.5 5"/></svg></i></span></li>
              </ol>
              <div className="callcard__foot" aria-hidden="true"><div className="meter"><span style={{ "--m": 1 } as CSSProperties}></span></div><span className="callcard__count">5 of 5 owned</span></div>
            </div>
            <div className="callcard callcard--plan" id="dk-c2" role="tabpanel" aria-roledescription="slide" aria-labelledby="dk-t2" data-card="2">
              <div className="callcard__head">
                <b>Someone plans ahead</b>
                <span className="tag">The roadmap</span>
              </div>
              <ol className="callcard__list">
              <li><span className="av">vC</span><span className="vn"><b>Fractional vCIO</b><small>One advisor owning your IT roadmap.</small></span><span className="st"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.5 5"/></svg></i></span></li>
              <li><span className="av">RC</span><span className="vn"><b>Regulatory compliance</b><small>Controls mapped to the rules you answer to.</small></span><span className="st"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.5 5"/></svg></i></span></li>
              <li><span className="av">$</span><span className="vn"><b>IT budgeting</b><small>A real plan. No surprise invoices.</small></span><span className="st"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.5 5"/></svg></i></span></li>
              <li><span className="av">VM</span><span className="vn"><b>Vendor management</b><small>We call the ISP. You don&rsquo;t.</small></span><span className="st"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.5 5"/></svg></i></span></li>
              <li><span className="av">QR</span><span className="vn"><b>Quarterly reviews</b><small>Policies, risks, and progress, in plain English.</small></span><span className="st"><i><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4 6.6 11.3 12.5 5"/></svg></i></span></li>
              </ol>
              <div className="callcard__foot" aria-hidden="true"><div className="meter"><span style={{ "--m": 1 } as CSSProperties}></span></div><span className="callcard__count">5 of 5 planned</span></div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 3 · PEAK: COVERAGE RINGS (dark, pinned) */
export function CoverageRings(): JSX.Element {
  return (
    <section className="scene rings dark sheet sheet--dark" id="levels" aria-labelledby="rings-h">
      <div className="scene__frame">
        <div className="wrap rings__grid">
          <div className="rings__copy">
            <p className="kicker">With DE</p>
            <h2 id="rings-h">Coverage that wraps around&nbsp;you.</h2>
            <p className="lede rings__lede">Four ProActive levels. Each one adds a ring to the last.</p>
            <div className="lvl" aria-live="polite">
              <article className="is-on"><p className="lvl__n">Level 1 of 4</p><h3>ProActive IT</h3><p>The foundation every level is built on.</p><p className="sr-only">Includes Service Desk, endpoint foundation, identity guidance, and a documented baseline.</p></article>
              <article><p className="lvl__n">Level 2 of 4</p><h3>ProActive Office</h3><p>Everything in IT, plus the network, the inbox, and backup.</p><p className="sr-only">Adds managed network, stronger identity, email anti-phishing, endpoint backup, and an annual review.</p></article>
              <article><p className="lvl__n">Level 3 of 4</p><h3>ProActive Business</h3><p>Everything in Office, plus detection, training, and recovery.</p><p className="sr-only">Adds threat detection, awareness training, BCDR posture, and compliance reporting support.</p></article>
              <article><p className="lvl__n">Level 4 of 4</p><h3>ProActive Enterprise</h3><p>Everything in Business, plus posture and compliance reporting at depth.</p><p className="sr-only">Adds unified posture reporting, advanced compliance reporting, custom BCDR support, and quarterly reviews.</p></article>
            </div>
            <div className="rail" id="rail" role="group" aria-label="Jump to a ProActive level">
              <button type="button" data-i="0"><span>IT</span><i></i></button>
              <button type="button" data-i="1"><span>Office</span><i></i></button>
              <button type="button" data-i="2"><span>Business</span><i></i></button>
              <button type="button" data-i="3"><span>Enterprise</span><i></i></button>
            </div>
          </div>
          <div className="orbit" id="orbit" aria-hidden="true">
            <svg className="orbit__svg" viewBox="-100 -100 200 200"></svg>
            <div className="core"><div className="core__disc"><b>Your business</b><small id="coreLvl">ProActive IT</small></div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 3b · WHOSE BUSINESS (dark coda, short, words not photos) */
export function WhoSection(): JSX.Element {
  return (
    <section className="who dark" id="who" aria-labelledby="who-h">
      <div className="wrap who__grid">
        <div className="who__head rv">
          <p className="kicker">Whose business?</p>
          <h2 id="who-h">Offices where downtime costs real money.</h2>
          <p className="lede">Based in Chandler, serving Greater Phoenix: Phoenix, Scottsdale, Tempe, Mesa, and Gilbert.</p>
        </div>
        <ul className="who__list" id="whoList">
          <li>Healthcare &amp; dental</li><li>Law firms</li><li>Accounting</li><li>Animal hospitals</li><li>Nonprofits</li><li>Real estate</li>
        </ul>
      </div>
    </section>
  );
}

/** 3c · START FROM A SITUATION (light) · B3: situation picker; last card always links to describe/ */
export function SituationsSection(): JSX.Element {
  return (
    <section className="sits light sheet" id="situations" aria-labelledby="sits-h">
      <div className="wrap">
        <div className="sits__head rv">
          <p className="kicker kicker--mag">Where you are now</p>
          <h2 id="sits-h">Start from a situation. <span>Pick the one that sounds like&nbsp;you.</span></h2>
        </div>
        <SituationPicker />
      </div>
    </section>
  );
}

/** 4 · PRICED IN THE OPEN (light) */
export function PriceSection(): JSX.Element {
  return (
    <section className="price light" id="pricing" aria-labelledby="price-h">
      <div className="wrap price__grid">
        <div className="price__head rv">
          <p className="kicker kicker--mag">Priced in the open</p>
          <h2 id="price-h">The price is on the&nbsp;page.</h2>
          <p className="lede">Every ProActive level has a published per-user floor and monthly minimum. Your number is confirmed after an assessment, not invented on a sales call.</p>
          <p className="price__link"><a className="textlink" href="/pricing" data-testid="button-hero-pricing">See the pricing</a></p>
        </div>
        <div className="track" id="track">
          <span className="track__line" aria-hidden="true"><i></i></span>
          <ol aria-label="How your price gets made">
          <li><span className="track__n">1</span><div><b>Fit Call</b><small>30 minutes. Is DE the right fit at all?</small>
            <div className="quote" aria-hidden="true"><div><span>Length</span><span className="quote__v">30 min</span></div><div><span>Booked</span><span className="quote__v">Online</span></div></div>
          </div></li>
          <li><span className="track__n">2</span><div><b>Assessment</b><small>What you actually run, measured, not guessed.</small>
            <div className="quote" aria-hidden="true"><div><span>Looks at</span><span className="quote__v">What you run today</span></div><div><span>Gives you</span><span className="quote__v">Your level, your number</span></div></div>
          </div></li>
          <li className="track__last"><span className="track__n">3</span><div><b>Your price, confirmed</b><small>Starting from the published floor for your level.</small>
            <div className="quote" aria-hidden="true">
              <div><span>Per user</span><span className="quote__v">Published floor</span></div>
              <div><span>Monthly minimum</span><span className="quote__v">Published</span></div>
              <div className="quote__src"><span>Source</span><span className="quote__v">/pricing</span></div>
            </div>
          </div></li>
          </ol>
        </div>
      </div>
    </section>
  );
}

/** 5 · SERVICE DESK vs HELP DESK (light) */
export function DeskSection(): JSX.Element {
  return (
    <section className="desk light" id="support" aria-labelledby="desk-h">
      <div className="wrap desk__grid">
        <div className="desk__head rv">
          <p className="kicker kicker--mag">Looked after</p>
          <h2 id="desk-h">Support, in plain words.</h2>
          <p className="lede">Two kinds, and you'll always know which one you're using.</p>
        </div>
        <div className="ticket" id="ticket">
          <div className="seg" role="tablist" aria-label="Support type">
            <button type="button" role="tab" id="t-sd" aria-selected="true" aria-controls="p-sd">Service Desk</button>
            <button type="button" role="tab" id="t-hd" aria-selected="false" aria-controls="p-hd" tabIndex={-1}>Help Desk</button>
            <span className="seg__thumb" aria-hidden="true"></span>
          </div>
          <div className="ticket__body">
            <div className="pane is-on" role="tabpanel" id="p-sd" aria-labelledby="t-sd" tabIndex={0}>
              <p className="pane__tag pane__tag--in">Included</p>
              <h3>Service Desk</h3>
              <p>Support that comes with every ProActive level. If it's in your bundle, it's covered.</p>
              <dl className="pane__rows"><div><dt>Who it's for</dt><dd>ProActive IT, Office, Business, and Enterprise clients</dd></div><div><dt>Billing</dt><dd>No separate support bill for covered work</dd></div></dl>
            </div>
            <div className="pane" role="tabpanel" id="p-hd" aria-labelledby="t-hd" tabIndex={0} hidden>
              <p className="pane__tag pane__tag--paid">Paid, when you need it</p>
              <h3>Help Desk</h3>
              <p>Paid support for work a bundle doesn't cover, and for businesses DE doesn't manage yet.</p>
              <dl className="pane__rows"><div><dt>Who it's for</dt><dd>Outside-the-bundle work, and businesses that aren't managed clients</dd></div><div><dt>Billing</dt><dd>Paid separately from a ProActive level</dd></div></dl>
            </div>
          </div>
          <p className="ticket__hint" aria-hidden="true">Scroll or tap to switch</p>
        </div>
      </div>
    </section>
  );
}

/** 6 · FAQ (light) */
export function FaqSection(): JSX.Element {
  return (
    <section className="faq light" id="faq" aria-labelledby="faq-h">
      <div className="wrap faq__grid">
        <h2 id="faq-h" className="rv">Before the call.</h2>
        <div className="faq__list rv">
          <details><summary>What happens on a Fit Call?<i aria-hidden="true"></i></summary><p>Thirty minutes on what you run today, what worries you, and whether a ProActive level makes sense for you. If DE isn't the right fit, you'll hear that too.</p></details>
          <details><summary>Is every price public?<i aria-hidden="true"></i></summary><p>Each ProActive level's per-user floor and monthly minimum is published on the pricing page. The final figure is confirmed after an assessment of your environment.</p></details>
          <details><summary>We already have an IT person. Is this for us?<i aria-hidden="true"></i></summary><p>It can be. Co-Managed IT lets you keep your internal IT and add DE for support, security expertise, and monitoring.</p></details>
          <details><summary>Where does DE work?<i aria-hidden="true"></i></summary><p>DE is based in Chandler and serves Arizona and Greater Phoenix, including Phoenix, Scottsdale, Tempe, Mesa, and Gilbert.</p></details>
        </div>
      </div>
    </section>
  );
}

/** 7 · CLOSE (bookend: the rings close around the same Fit Call card; the sticky note comes back) */
export function CloseSection(): JSX.Element {
  return (
    <section className="close dark sheet sheet--dark" id="fit-call" aria-labelledby="close-h">
      <div className="wrap close__grid">
        <div className="close__copy rv">
          <h2 id="close-h">Thirty minutes. Then you'll&nbsp;know.</h2>
          <p className="lede">A Fit Call is a straight conversation about what you run today and whether DE should own it.</p>
        </div>
        <div className="close__art rv" id="closeArt">
          <svg className="halo halo--closed" viewBox="-100 -100 200 200" aria-hidden="true"></svg>
          <aside className="fitcard fitcard--close" aria-label="Book a Fit Call">
            <p className="note note--close" aria-hidden="true">Bring this.<br />We'll take it from here.</p>
            <div className="fitcard__top"><span className="mono" aria-hidden="true">DE</span><span><b>Digerati Experts</b><small>Booked online with Zoho Bookings</small></span></div>
            <h3 className="fitcard__title">Fit Call</h3>
            <p className="fitcard__meta"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.3 1.5"/></svg>30 minutes</p>
            <a className="btn btn--lg btn--block" href={FIT_CALL_URL} target="_blank" rel="noopener">Book a Fit Call <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"/></svg></a>
          </aside>
        </div>
      </div>
    </section>
  );
}
