import { cyberAwarenessFacts } from "@/data/cyberAwarenessFacts";
import { HomeScene } from "../scene/HomeScene";

const MFA_SOURCE_URL =
  cyberAwarenessFacts.find((fact) => fact.id === "microsoft-mfa-blocks-2025")?.sourceUrl ?? null;

const STATS = [
  { figure: "48%", text: "of breaches involve ransomware", source: "Verizon DBIR 2026", href: "https://www.verizon.com/business/resources/reports/dbir/" },
  { figure: "$11.5M", text: "average cost of a data breach in the United States", source: "IBM Cost of a Data Breach 2026", href: "https://www.ibm.com/reports/data-breach" },
  { figure: "99%+", text: "of unauthorized access attempts are blocked by MFA", source: "Microsoft Digital Defense Report 2025", href: MFA_SOURCE_URL },
  { figure: "$392M", text: "in internet crime losses reported from Arizona in 2024", source: "FBI IC3 Annual Report 2024 (PDF)", href: "https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf" },
];

export function ThreatStatsSection(): JSX.Element {
  return (
    <section className="sec band t-ink" id="stats">
      <HomeScene frame="exposure" />
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">The threats are real</p>
            <h2>Don't become a statistic.</h2>
          </div>
          <div className="links">
            <p className="lede">Endpoint, identity, and recovery discipline have to be owned, not assumed.</p>
            <a className="link" href="/resources/cyber-facts">See the full sourced facts</a>
          </div>
        </div>
        <div className="stats-grid">
          {STATS.map((stat) => (
            <div className="stat" key={stat.figure}>
              <b>{stat.figure}</b>
              <p>{stat.text}</p>
              {stat.href ? (
                <a href={stat.href} target="_blank" rel="noopener noreferrer">{stat.source} ↗</a>
              ) : (
                <span className="small muted">{stat.source}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
