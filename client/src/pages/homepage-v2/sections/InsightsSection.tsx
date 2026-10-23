/**
 * The live threat feed no longer sits on the homepage (Lane H, 2026-10-22): it was often empty
 * at the homepage threshold and repeated threat messaging. The full stream, with its sources note,
 * lives at Security Updates; this section is a slim link strip (Joe review, 2026-10-23).
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
      </div>
    </section>
  );
}
