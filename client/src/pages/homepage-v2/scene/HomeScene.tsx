import "./home-scene.css";

/*
 * The scene story on Homepage v2 (from Version 10, Joe 2026-10-25: "make Homepage v2
 * visually stronger while preserving everything already approved"). One diorama of
 * the visitor's business, shot from the same camera, so each section's backdrop is
 * the next state of the same place:
 *
 *   #stats       exposure   pressure arriving at its edge
 *   #challenges  gaps       six breaks glowing in its perimeter (light edition)
 *   #protection  protected  layered rings closing around it
 *   #contact     close      lit at dusk, one path leading in
 *
 * The first frame (network, a calm business network) is not placed: #why has no open
 * space beside its cards, and the hero already carries its own photograph.
 *
 * Decorative only: aria-hidden, empty alt, no pointer events, lazy. It is the first
 * child of its section; home-scene.css lifts the section's other children above it,
 * so no section markup or approved style changes. Frames are the approved
 * scene-story images (design/approved/homepage-scene-story-2026-10.md).
 */
export type HomeSceneFrame = "exposure" | "gaps" | "protected" | "close";

const FILE: Record<HomeSceneFrame, string> = {
  exposure: "2-exposure",
  gaps: "3-gaps",
  protected: "4-protected",
  close: "5-close",
};

const DIR = "/images/visual-system/scene-story";

export function HomeScene({ frame }: { frame: HomeSceneFrame }): JSX.Element {
  const f = FILE[frame];
  return (
    <div className={`hscene hscene--${frame}`} aria-hidden="true" data-testid={`home-scene-${frame}`}>
      <img
        className="hscene__img"
        src={`${DIR}/${f}-1600.webp`}
        srcSet={`${DIR}/${f}-960.webp 960w, ${DIR}/${f}-1600.webp 1600w`}
        sizes="(min-width: 1024px) 62vw, 100vw"
        alt=""
        width={1600}
        height={893}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />
    </div>
  );
}
