import "./scene.css";

/*
 * The scene story (Version 10). The opening chapters, and the close, sit on one
 * diorama of the visitor's business, shot from the same camera, so each section's
 * background is the next state of the same place:
 *
 *   02 Why we exist   network   a calm business network
 *   03 Threats        exposure  pressure arriving at its edge
 *   04 What we tackle gaps      breaks glowing in its perimeter
 *   06 Eight blocks   protected layered rings closing around it
 *   16 Contact        close     lit at dusk, one path leading in
 *
 * kie.ai frames, ILLUSTRATIVE and decorative: aria-hidden, no pointer events.
 * Sits where the section's ChapterPattern used to (first child of an isolated
 * section, z-index -1). The building stays in the same place on screen from frame
 * to frame, which is what makes five backgrounds read as one story.
 */
export type SceneFrame = "network" | "exposure" | "gaps" | "protected" | "close";

const FILE: Record<SceneFrame, string> = {
  network: "1-network",
  exposure: "2-exposure",
  gaps: "3-gaps",
  protected: "4-protected",
  close: "5-close",
};

const DIR = "/images/visual-system/scene-story";

export function SceneBackdrop({ frame }: { frame: SceneFrame }): JSX.Element {
  const f = FILE[frame];
  return (
    <div className={`scene scene--${frame}`} aria-hidden="true" data-testid={`scene-${frame}`}>
      <img
        className="scene__img"
        src={`${DIR}/${f}-1600.webp`}
        srcSet={`${DIR}/${f}-960.webp 960w, ${DIR}/${f}-1600.webp 1600w`}
        sizes="(min-width: 1024px) 64vw, 100vw"
        alt=""
        width={1600}
        height={893}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
