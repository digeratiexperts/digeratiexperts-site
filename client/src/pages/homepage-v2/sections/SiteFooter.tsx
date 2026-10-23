import { useState, type FormEvent } from "react";
import { DE_LOGO_REVERSE } from "@/lib/brandAssets";
import { EMAIL_ADDRESS, PHONE_DISPLAY, PHONE_HREF } from "../content";

const COLUMNS = [
  { title: "Client", links: [["Client Portal", "/portal/login"], ["Submit Ticket", "/support/submit-ticket"], ["Remote Support", "/support/remote-support"], ["Pay Invoice", "/support/pay-invoice"]] },
  { title: "Services", links: [["Managed IT", "/solutions/managed-it-support"], ["Cybersecurity", "/solutions"], ["Compliance & Risk", "/about/compliance"], ["Backup & DR", "/solutions/backup-disaster-recovery"]] },
  { title: "Resources", links: [["Digerati Journal", "/resources/blog"], ["Cyber Facts", "/resources/cyber-facts"], ["Knowledge Base", "/support/knowledge-base"], ["Contact", "#contact"]] },
];

const LEGAL_LINKS = [
  ["Trust Center", "/trust/trust-center"],
  ["Status", "/trust"],
  ["Vulnerability Disclosure", "/trust/vulnerability-disclosure"],
  ["Privacy", "/legal/privacy-policy"],
  ["Terms", "/legal/terms-of-use"],
  ["MSA", "/legal/msa"],
  ["SLA", "/legal/sla"],
];

/** Newsletter: the same POST /api/newsletter the homepage footer used. */
function NewsletterForm(): JSX.Element {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    setStatus("sending");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("Subscribe failed");
      form.reset();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <form className="news" onSubmit={onSubmit}>
        <label htmlFor="hv2-newsletter" style={{ position: "absolute", left: -9999 }}>Email address</label>
        <input id="hv2-newsletter" name="email" type="email" required placeholder="Your email" />
        <button type="submit" disabled={status === "sending"}>Subscribe</button>
      </form>
      {status === "done" && <p className="small" role="status">Thanks for subscribing.</p>}
      {status === "error" && <p className="small" role="alert">Could not subscribe. Please try again.</p>}
    </>
  );
}

export function SiteFooter(): JSX.Element {
  return (
    <footer>
      <div className="wrap">
        <div className="fgrid">
          <div>
            <a href="/" className="logo"><img src={DE_LOGO_REVERSE} alt="Digerati Experts" /></a>
            <p style={{ marginTop: 18 }}>Cybersecurity and managed IT<br />Chandler, Arizona</p>
            <p style={{ marginTop: 12 }}><a href={PHONE_HREF}>{PHONE_DISPLAY}</a><br /><a href={`mailto:${EMAIL_ADDRESS}`}>{EMAIL_ADDRESS}</a></p>
            <NewsletterForm />
          </div>
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h4>{column.title}</h4>
              <ul>
                {column.links.map(([label, href]) => (
                  <li key={label}><a href={href}>{label}</a></li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h4>Trust &amp; legal</h4>
            <ul>
              {LEGAL_LINKS.map(([label, href]) => (
                <li key={label}><a href={href}>{label}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="fbase">
          <span>© {new Date().getFullYear()} Digerati Experts, Chandler, Arizona</span>
          <span><a href="/trust/accessibility">Accessibility</a> &nbsp; <a href="/trust">Security</a></span>
        </div>
      </div>
    </footer>
  );
}
