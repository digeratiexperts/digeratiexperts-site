/**
 * PageFlip — a dependency-free page-turn engine.
 *
 * Prototyped and verified in artifacts/design-concepts/page-flip/ (PR 470).
 * See that directory for the rendered evidence at 1440 / 768 / 390.
 *
 * Why no library: Tier 0 of design/DESIGN-AUTHORITY.md forbids gratuitous
 * dependencies and CI holds a browser bundle budget. This repo's precedent for
 * heavy viewer code is to vendor it under public/vendor/ and load it on demand
 * (scripts/vendor-pdfjs.mjs), never to bundle it. So this is plain DOM with no
 * framework coupling: it takes elements and returns elements, which is what lets
 * the same engine serve a React route and a standalone page unchanged.
 *
 * THE BOOK MODEL
 * A book is leaves, not pages. One leaf carries two pages: its front (recto,
 * odd) and its back (verso, even). `leaf` is how many leaves have been turned:
 *   left  side = back  face of leaf[leaf - 1]
 *   right side = front face of leaf[leaf]
 * Turning leaf L rotates it about the spine from 0deg to -180deg, at which point
 * its back face has become the new left page. This is why spreads pair (2,3) and
 * (4,5), and why a cover stands alone.
 *
 * WHAT MAKES IT READ AS PAPER
 * Rotation alone is a hinged board. Three things sell it, all driven off one
 * normalised angle t (0 = flat, 1 = fully turned):
 *   1. Lighting — the receding face darkens, the arriving face lifts out of
 *      shadow. Both track sin(t * PI), peaking where the leaf is edge-on.
 *   2. A fold gradient near the spine, standing in for the stiffness a real
 *      sheet takes under its own weight.
 *   3. A shadow cast on the page below as the leaf passes over it.
 *
 * ACCESSIBILITY (Tier 0)
 *   - prefers-reduced-motion: pages change instantly; no rotation, no drag.
 *   - Keyboard: ArrowLeft / ArrowRight / Home / End.
 *   - The page label is a live region, so a screen reader is told where it landed.
 *   - Drag is an enhancement; everything is reachable without a pointer.
 */

export type PageRenderer = (pageIndex: number) => HTMLElement;

export interface PageFlipOptions {
  /** One renderer per page, 0-indexed. Called lazily, so a long PDF does not
   *  rasterise every page up front. */
  pages: PageRenderer[];
  /** Milliseconds for a full programmatic turn. */
  duration?: number;
  /** Force two-up. Defaults to a width query. */
  spread?: boolean;
  onChange?: (state: { leaf: number; leaves: number; label: string }) => void;
  /** Render the built-in page label. Pass false when the host already shows the
   *  label from onChange — two live regions announcing the same move is worse
   *  for a screen reader than one, so only one of them may exist. */
  status?: boolean;
}

type Slot = 'left' | 'right' | 'front' | 'back';

const EASE_OUT_CUBIC = (x: number): number => 1 - Math.pow(1 - x, 3);

/** Past this fraction of a turn, release completes it instead of springing back. */
const COMMIT_THRESHOLD = 0.3;

/** Pointer travel (px) before a press counts as a drag rather than a click. */
const DRAG_SLOP = 6;

export class PageFlip {
  private readonly root: HTMLElement;
  private readonly renderers: PageRenderer[];
  private readonly pageCount: number;
  private readonly duration: number;
  private readonly showStatus: boolean;
  private readonly leafCount: number;
  private onChange: PageFlipOptions['onChange'];

  private leaf = 0;
  private cache = new Map<string, HTMLElement>();
  private animation = 0;
  private drag: { dir: 1 | -1; startX: number; box: DOMRect; moved: boolean; t: number } | null = null;
  private spread: boolean;

  private readonly motionQuery: MediaQueryList;
  private readonly spreadQuery: MediaQueryList;
  private readonly onSpreadChange: (e: MediaQueryListEvent) => void;
  private readonly onPointerMoveBound: (e: PointerEvent) => void;
  private readonly onPointerUpBound: () => void;
  private readonly onPointerCancelBound: () => void;

  private book!: HTMLElement;
  private left!: HTMLElement;
  private right!: HTMLElement;
  private leafEl!: HTMLElement;
  private frontEl!: HTMLElement;
  private backEl!: HTMLElement;
  private frontShade!: HTMLElement;
  private backShade!: HTMLElement;
  private frontFold!: HTMLElement;
  private backFold!: HTMLElement;
  private cast!: HTMLElement;
  private status: HTMLElement | null = null;

  constructor(root: HTMLElement, options: PageFlipOptions) {
    this.root = root;
    this.renderers = options.pages;
    this.pageCount = options.pages.length;
    this.duration = options.duration ?? 620;
    this.showStatus = options.status ?? true;
    this.onChange = options.onChange;

    // An odd final page still occupies a whole leaf; its back renders blank,
    // exactly as the last sheet of a real book does.
    this.leafCount = Math.ceil(this.pageCount / 2);

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.spreadQuery = window.matchMedia('(min-width: 820px)');
    this.spread = options.spread ?? this.spreadQuery.matches;

    this.onSpreadChange = (e) => { this.spread = e.matches; this.render(); };
    this.onPointerMoveBound = (e) => this.onPointerMove(e);
    this.onPointerUpBound = () => this.onPointerUp();
    this.onPointerCancelBound = () => this.cancelDrag();

    this.build();
    this.bind();
    this.render();
  }

  // ---------------------------------------------------------------- structure

  private build(): void {
    this.root.classList.add('pf-root');
    this.root.innerHTML = `
      <div class="pf-book" tabindex="0" role="application"
           aria-roledescription="flipbook" aria-label="Document, use arrow keys to turn pages">
        <div class="pf-side pf-side-left"  aria-hidden="true"></div>
        <div class="pf-side pf-side-right" aria-hidden="true"></div>
        <div class="pf-leaf" aria-hidden="true">
          <div class="pf-face pf-face-front"><div class="pf-content"></div><div class="pf-shade"></div><div class="pf-fold"></div></div>
          <div class="pf-face pf-face-back"><div class="pf-content"></div><div class="pf-shade"></div><div class="pf-fold"></div></div>
        </div>
        <div class="pf-cast" aria-hidden="true"></div>
      </div>
      ${this.showStatus ? '<p class="pf-status" role="status" aria-live="polite"></p>' : ''}
    `;

    const pick = <T extends HTMLElement>(sel: string): T => {
      const el = this.root.querySelector<T>(sel);
      if (!el) throw new Error(`PageFlip: missing ${sel}`);
      return el;
    };

    this.book = pick('.pf-book');
    this.left = pick('.pf-side-left');
    this.right = pick('.pf-side-right');
    this.leafEl = pick('.pf-leaf');
    this.frontEl = pick('.pf-face-front .pf-content');
    this.backEl = pick('.pf-face-back .pf-content');
    this.frontShade = pick('.pf-face-front .pf-shade');
    this.backShade = pick('.pf-face-back .pf-shade');
    this.frontFold = pick('.pf-face-front .pf-fold');
    this.backFold = pick('.pf-face-back .pf-fold');
    this.cast = pick('.pf-cast');
    this.status = this.showStatus ? pick('.pf-status') : null;
  }

  private bind(): void {
    this.book.addEventListener('keydown', (e) => {
      const actions: Record<string, () => void> = {
        ArrowRight: () => this.next(),
        ArrowLeft: () => this.prev(),
        Home: () => this.goToLeaf(0),
        End: () => this.goToLeaf(this.lastLeaf()),
      };
      const run = actions[e.key];
      // Stop as well as prevent: a host usually puts the same arrow-key handler
      // on the surrounding section so the keys work before the book has focus.
      // Without this the key is handled twice and the book jumps two leaves.
      if (run) { e.preventDefault(); e.stopPropagation(); run(); }
    });

    this.book.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', this.onPointerMoveBound);
    window.addEventListener('pointerup', this.onPointerUpBound);
    window.addEventListener('pointercancel', this.onPointerCancelBound);
    this.spreadQuery.addEventListener('change', this.onSpreadChange);
  }

  // -------------------------------------------------------------- page access

  /**
   * Lazily render and memoise one page FOR ONE SLOT.
   *
   * Keyed by slot, not by page index, and that is a correctness requirement, not
   * an optimisation. A DOM element exists in exactly one place, so a single
   * cached node handed to two slots silently removes itself from the first.
   * Mid-turn that empties the page under the leaf, and since both faces are
   * edge-on and invisible at 90deg, the whole book blanks out.
   *
   * Cloning would be cheaper and wrong here: these pages are pdf.js canvases and
   * cloneNode copies the element without its bitmap. So each slot gets its own
   * render — four live instances per page at most, and the renderer is free to
   * cache the parsed PDF page behind it.
   */
  private page(slot: Slot, index: number): HTMLElement | null {
    if (index < 0 || index >= this.pageCount) return null;
    const key = `${slot}:${index}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const made = this.renderers[index](index);
    this.cache.set(key, made);
    return made;
  }

  private mount(host: HTMLElement, index: number, slot: Slot): void {
    host.replaceChildren();
    const el = this.page(slot, index);
    if (el) host.appendChild(el);
    host.classList.toggle('is-blank', !el);
  }

  // ------------------------------------------------------------------ drawing

  render(): void {
    this.root.classList.toggle('is-spread', this.spread);

    if (this.spread) {
      this.mount(this.left, this.leaf * 2 - 1, 'left');
      this.mount(this.right, this.leaf * 2, 'right');
    } else {
      this.mount(this.left, -1, 'left');
      this.mount(this.right, this.leaf, 'right');
    }

    this.leafEl.style.visibility = 'hidden';
    this.applyAngle(0);

    const label = this.spread ? this.spreadLabel() : `Page ${this.leaf + 1} of ${this.pageCount}`;
    if (this.status) this.status.textContent = label;
    this.book.setAttribute('aria-label', `Document. ${label}. Use arrow keys to turn pages.`);
    this.onChange?.({ leaf: this.leaf, leaves: this.lastLeaf() + 1, label });
  }

  /** Name the pages actually on screen: one or two, never "Pages 1–1". */
  private spreadLabel(): string {
    const visible = [this.leaf * 2 - 1, this.leaf * 2]
      .filter((i) => i >= 0 && i < this.pageCount)
      .map((i) => i + 1);

    if (visible.length === 2) return `Pages ${visible[0]}–${visible[1]} of ${this.pageCount}`;
    if (visible.length === 1) return `Page ${visible[0]} of ${this.pageCount}`;
    return `${this.pageCount} pages`;
  }

  /**
   * Drive every visual off one number.
   * @param t   0 = flat on the right, 1 = fully turned onto the left
   * @param dir 1 = turning forward, -1 = turning back
   */
  private applyAngle(t: number, dir: 1 | -1 = 1): void {
    const clamped = Math.max(0, Math.min(1, t));
    this.leafEl.style.transform = `rotateY(${-180 * clamped}deg)`;

    // Edge-on at the midpoint, so lighting and fold both peak there.
    const peak = Math.sin(clamped * Math.PI);

    // Capped below 1: paper scatters light, it does not occlude.
    this.frontShade.style.opacity = String(peak * 0.55);
    this.backShade.style.opacity = String((1 - peak) * 0.5 + 0.08);
    this.frontFold.style.opacity = String(peak * 0.9);
    this.backFold.style.opacity = String(peak * 0.9);

    this.cast.style.opacity = String(peak * 0.42);
    this.cast.style.transform =
      `translateX(${(dir > 0 ? 1 : -1) * clamped * 14}%) scaleX(${0.55 + peak * 0.6})`;
  }

  // ---------------------------------------------------------------- animation

  /** Load the leaf's two faces for a turn in `dir`, then reveal it. */
  private arm(dir: 1 | -1): void {
    if (dir > 0) {
      this.mount(this.frontEl, this.spread ? this.leaf * 2 : this.leaf, 'front');
      this.mount(this.backEl, this.spread ? this.leaf * 2 + 1 : this.leaf + 1, 'back');
      // Lift a recto in a real book and the NEXT recto is waiting below it, not
      // the sheet in your hand. Leaving the old page here made the leaf look as
      // though it tore a hole in the book as it rose.
      if (this.spread) this.mount(this.right, this.leaf * 2 + 2, 'right');
    } else {
      const target = this.leaf - 1;
      this.mount(this.frontEl, this.spread ? target * 2 : target, 'front');
      this.mount(this.backEl, this.spread ? target * 2 + 1 : target + 1, 'back');
      // Mirror image: the destination left-hand page waits under the returning leaf.
      if (this.spread) this.mount(this.left, target * 2 - 1, 'left');
    }
    this.leafEl.style.visibility = 'visible';
  }

  private animate(from: number, to: number, dir: 1 | -1, done: () => void): void {
    if (this.motionQuery.matches) { this.applyAngle(to, dir); done(); return; }

    cancelAnimationFrame(this.animation);
    const start = performance.now();
    const span = Math.abs(to - from) * this.duration;

    const step = (now: number): void => {
      const p = span === 0 ? 1 : Math.min(1, (now - start) / span);
      this.applyAngle(from + (to - from) * EASE_OUT_CUBIC(p), dir);
      if (p < 1) this.animation = requestAnimationFrame(step);
      else done();
    };
    this.animation = requestAnimationFrame(step);
  }

  // ------------------------------------------------------------------ control

  next(): void {
    if (this.drag || this.leaf >= this.lastLeaf()) return;
    this.arm(1);
    this.animate(0, 1, 1, () => { this.leaf += 1; this.render(); });
  }

  prev(): void {
    if (this.drag || this.leaf <= 0) return;
    this.arm(-1);
    this.animate(1, 0, -1, () => { this.leaf -= 1; this.render(); });
  }

  goToLeaf(index: number): void {
    const target = Math.max(0, Math.min(this.lastLeaf(), index));
    if (target === this.leaf) return;
    this.leaf = target;
    this.render();
  }

  private lastLeaf(): number {
    return this.spread ? this.leafCount - 1 : this.pageCount - 1;
  }

  // --------------------------------------------------------------------- drag

  private onPointerDown(e: PointerEvent): void {
    if (this.motionQuery.matches || e.button !== 0) return;
    const box = this.book.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;

    // Grab from the outer third of either side, the way a hand finds a corner.
    const dir: 1 | -1 | 0 = x > 0.66 ? 1 : x < 0.34 ? -1 : 0;
    if (!dir) return;
    if (dir > 0 && this.leaf >= this.lastLeaf()) return;
    if (dir < 0 && this.leaf <= 0) return;

    this.drag = { dir, startX: e.clientX, box, moved: false, t: dir > 0 ? 0 : 1 };
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.startX;
    if (!this.drag.moved) {
      if (Math.abs(dx) < DRAG_SLOP) return;
      this.drag.moved = true;
      this.arm(this.drag.dir);
      this.book.classList.add('is-dragging');
    }
    const reach = this.drag.box.width * (this.spread ? 0.5 : 1);
    const progress = -dx / reach;
    this.drag.t = Math.max(0, Math.min(1, this.drag.dir > 0 ? progress : 1 + progress));
    this.applyAngle(this.drag.t, this.drag.dir);
  }

  private onPointerUp(): void {
    if (!this.drag) return;
    const { dir, t, moved } = this.drag;
    this.book.classList.remove('is-dragging');

    if (!moved) { this.drag = null; return; }      // a tap, not a drag
    this.drag = null;

    const committed = dir > 0 ? t > COMMIT_THRESHOLD : t < 1 - COMMIT_THRESHOLD;
    if (committed) {
      this.animate(t, dir > 0 ? 1 : 0, dir, () => { this.leaf += dir; this.render(); });
    } else {
      this.animate(t, dir > 0 ? 0 : 1, dir, () => this.render());
    }
  }

  private cancelDrag(): void {
    if (!this.drag) return;
    this.book.classList.remove('is-dragging');
    this.drag = null;
    this.render();
  }

  destroy(): void {
    cancelAnimationFrame(this.animation);
    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('pointercancel', this.onPointerCancelBound);
    this.spreadQuery.removeEventListener('change', this.onSpreadChange);
    this.onChange = undefined;
    this.cache.clear();
    this.root.replaceChildren();
  }
}
