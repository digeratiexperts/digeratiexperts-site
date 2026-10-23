/**
 * The live threat feed no longer sits on the homepage (Lane H, 2026-10-22): it was often empty
 * at the homepage threshold and repeated threat messaging. The full stream lives at Security Updates.
 */
export function InsightsSection(): JSX.Element {
  return (
    <section className="sec t-store" id="insights">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">Security updates</p>
            <h2>Recent threats and insights.</h2>
          </div>
          <div className="links">
            <a className="link" href="/resources/security-updates">View all security updates</a>
            <a className="link" href="/resources/blog">Read the Digerati Journal</a>
          </div>
        </div>
        <p className="note">Sources: CISA, NIST NVD, FIRST, Microsoft MSRC. Prioritized by active exploitation, exploit probability, and SMB relevance.</p>
      </div>
    </section>
  );
}
