/**
 * PageFlip — a dependency-free page-turn engine.
 *
 * Why this exists: client/src/pages/resources/DocumentFlipbook.tsx calls itself a
 * flipbook but changes pages with a 200ms crossfade (opacity + rotateY(4deg) + 8px
 * slide). It reads as a slideshow, not a book.
 *
 * Why no library: Tier 0 of design/DESIGN-AUTHORITY.md forbids gratuitous
 * dependencies and CI enforces a browser bundle budget. This repo's own precedent
 * for heavy viewer code is to vendor it under public/vendor/ and load it on demand
 * (see scripts/vendor-pdfjs.mjs), never to bundle it. So this is written to have
 * zero dependencies and no framework coupling: it takes elements and returns
 * elements, so it drops into the React component or a plain page equally.
 *
 * THE BOOK MODEL
 * A book is leaves, not pages. One leaf carries two pages: its front (recto, odd)
 * and its back (verso, even). `leaf` is how many leaves have been turned, so:
 *   left  side  = back  face of leaf[leaf - 1]
 *   right side  = front face of leaf[leaf]
 * Turning leaf L rotates it about the spine from 0deg to -180deg, at which point
 * its back face has become the new left page. This is why a real book's page count
 * and its leaf count differ, and why spreads pair (2,3), (4,5) and not (1,2).
 *
 * WHAT MAKES IT READ AS PAPER
 * Rotation alone looks like a hinged board. Three things sell it, all driven off
 * the same normalised angle t (0 = closed, 1 = fully turned):
 *   1. Lighting — the receding face darkens as it turns away from the viewer and
 *      the arriving face lifts out of shadow. Opacity tracks sin(t * PI), so both
 *      peak at the midpoint where the leaf is edge-on.
 *   2. A fold gradient near the spine, strongest mid-turn, standing in for the
 *      slight curl a real page takes under its own stiffness.
 *   3. A cast shadow that sweeps across the page underneath as the leaf passes
 *      over it.
 *
 * ACCESSIBILITY (Tier 0, non-negotiable)
 *   - prefers-reduced-motion: pages change instantly, no rotation, no drag inertia.
 *   - Keyboard: ArrowLeft/ArrowRight/Home/End, focus stays on the book.
 *   - The page region is a live region so a screen reader is told where it landed.
 *   - Pointer drag is an enhancement; every action is reachable without it.
 */

const EASE_OUT_CUBIC = (x) => 1 - Math.pow(1 - x, 3);

/** Angle at which a release completes the turn rather than springing back. */
const COMMIT_THRESHOLD = 0.3;

/** Pointer travel (px) before a press is treated as a drag and not a click. */
const DRAG_SLOP = 6;

export class PageFlip {
  /**
   * @param {HTMLElement} root       container; sized by CSS, not by this class
   * @param {object}      options
   * @param {Array<(pageIndex:number)=>HTMLElement>} options.pages
   *        One renderer per page, 0-indexed. Called lazily and memoised, so a
   *        1,000-page PDF does not rasterise 1,000 canvases up front.
   * @param {number}  [options.duration=620]  ms for a full programmatic turn
   * @param {boolean} [options.spread]        two-up; defaults to a width query
   * @param {(state:{page:number,pages:number})=>void} [options.onChange]
   */
  constructor(root, options) {
    this.root = root;
    this.renderers = options.pages;
    this.pageCount = options.pages.length;
    this.duration = options.duration ?? 620;
    this.onChange = options.onChange ?? (() => {});

    // Leaves, not pages. An odd final page still occupies a whole leaf; its back
    // renders blank, exactly as the last sheet of a real book does.
    this.leafCount = Math.ceil(this.pageCount / 2);
    this.leaf = 0;

    this.cache = new Map();
    this.animation = null;
    this.drag = null;

    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.spreadQuery = window.matchMedia('(min-width: 820px)');
    this.spread = options.spread ?? this.spreadQuery.matches;

    this.#build();
    this.#bind();
    this.render();
  }

  // ---------------------------------------------------------------- structure

  #build() {
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
      <p class="pf-status" role="status" aria-live="polite"></p>
    `;

    this.book = this.root.querySelector('.pf-book');
    this.left = this.root.querySelector('.pf-side-left');
    this.right = this.root.querySelector('.pf-side-right');
    this.leafEl = this.root.querySelector('.pf-leaf');
    this.frontEl = this.root.querySelector('.pf-face-front .pf-content');
    this.backEl = this.root.querySelector('.pf-face-back .pf-content');
    this.frontShade = this.root.querySelector('.pf-face-front .pf-shade');
    this.backShade = this.root.querySelector('.pf-face-back .pf-shade');
    this.frontFold = this.root.querySelector('.pf-face-front .pf-fold');
    this.backFold = this.root.querySelector('.pf-face-back .pf-fold');
    this.cast = this.root.querySelector('.pf-cast');
    this.status = this.root.querySelector('.pf-status');
  }

  #bind() {
    this.book.addEventListener('keydown', (e) => {
      const map = { ArrowRight: () => this.next(), ArrowLeft: () => this.prev(),
                    Home: () => this.goToLeaf(0), End: () => this.goToLeaf(this.leafCount - 1) };
      if (map[e.key]) { e.preventDefault(); map[e.key](); }
    });

    this.book.addEventListener('pointerdown', (e) => this.#onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.#onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.#onPointerUp(e));
    window.addEventListener('pointercancel', () => this.#cancelDrag());

    // Crossing the spread breakpoint changes which pages pair, so re-render.
    const onSpread = (e) => { this.spread = e.matches; this.render(); };
    this.spreadQuery.addEventListener?.('change', onSpread);
  }

  // -------------------------------------------------------------- page access

  /**
   * Lazily render and memoise one page FOR ONE SLOT. Out-of-range returns null,
   * which renders as blank paper.
   *
   * Keyed by slot, not by page index, and that is not an optimisation detail —
   * it is a correctness requirement. A DOM element exists in exactly one place,
   * so a single cached node handed to two slots silently removes itself from the
   * first. Mid-turn that empties the page underneath the leaf, and since both
   * leaf faces are edge-on and invisible at 90deg, the entire book blanks out.
   *
   * Cloning instead would be cheaper but wrong for the real payload: these pages
   * are pdf.js canvases, and cloneNode copies the element without its bitmap.
   * So each slot gets its own render. Bounded at four live instances per page,
   * and the renderer is free to cache the parsed PDF page behind it.
   */
  #page(slot, index) {
    if (index < 0 || index >= this.pageCount) return null;
    const key = `${slot}:${index}`;
    if (!this.cache.has(key)) this.cache.set(key, this.renderers[index](index));
    return this.cache.get(key);
  }

  #mount(host, index, slot) {
    host.replaceChildren();
    const el = this.#page(slot, index);
    if (el) host.appendChild(el);
    host.classList.toggle('is-blank', !el);
  }

  // ------------------------------------------------------------------ drawing

  render() {
    this.root.classList.toggle('is-spread', this.spread);

    if (this.spread) {
      // leaf L: left shows page 2L-1 (back of previous leaf), right shows 2L.
      this.#mount(this.left, this.leaf * 2 - 1, 'left');
      this.#mount(this.right, this.leaf * 2, 'right');
    } else {
      // Single-page: one page at a time, the right side is the only side.
      this.#mount(this.left, -1, 'left');
      this.#mount(this.right, this.leaf, 'right');
    }

    this.leafEl.style.visibility = 'hidden';
    this.#applyAngle(0);

    // Leaf 0 is the cover: it stands alone on the right with nothing facing it,
    // and the last leaf of an odd-page book is alone too. Only a genuine pair
    // gets a range, so the label never reads "Pages 1–1".
    const human = this.spread ? this.#spreadLabel() : `Page ${this.leaf + 1} of ${this.pageCount}`;
    this.status.textContent = human;
    this.book.setAttribute('aria-label', `Document. ${human}. Use arrow keys to turn pages.`);
    this.onChange({ page: this.leaf, pages: this.spread ? this.leafCount : this.pageCount });
  }

  /** Name the pages actually on screen, which is one page or two, never "1–1". */
  #spreadLabel() {
    const visible = [this.leaf * 2 - 1, this.leaf * 2]
      .filter((i) => i >= 0 && i < this.pageCount)
      .map((i) => i + 1);                             // humans count from one

    if (visible.length === 2) return `Pages ${visible[0]}–${visible[1]} of ${this.pageCount}`;
    if (visible.length === 1) return `Page ${visible[0]} of ${this.pageCount}`;
    return `${this.pageCount} pages`;
  }

  /**
   * Drive every visual off one number.
   * @param {number} t 0 = flat on the right, 1 = fully turned onto the left
   * @param {1|-1}  dir  1 = turning forward, -1 = turning back
   */
  #applyAngle(t, dir = 1) {
    const clamped = Math.max(0, Math.min(1, t));
    const angle = -180 * clamped;
    this.leafEl.style.transform = `rotateY(${angle}deg)`;

    // Edge-on at the midpoint, so both lighting and fold peak there.
    const peak = Math.sin(clamped * Math.PI);

    // The receding face loses light; the arriving face gains it. Capped below 1
    // so a page never goes fully black — paper scatters light, it does not occlude.
    this.frontShade.style.opacity = String(peak * 0.55);
    this.backShade.style.opacity = String((1 - peak) * 0.5 + 0.08);

    // Fold: the stiffness highlight near the spine.
    this.frontFold.style.opacity = String(peak * 0.9);
    this.backFold.style.opacity = String(peak * 0.9);

    // Cast shadow sweeps across the page underneath as the leaf passes over.
    this.cast.style.opacity = String(peak * 0.42);
    this.cast.style.transform = `translateX(${(dir > 0 ? 1 : -1) * clamped * 14}%) scaleX(${0.55 + peak * 0.6})`;
  }

  // ---------------------------------------------------------------- animation

  /** Prepare the leaf's two faces for a turn in `dir`, then reveal it. */
  #arm(dir) {
    if (dir > 0) {
      // Forward: front = the page being lifted, back = what it reveals on the left.
      this.#mount(this.frontEl, this.spread ? this.leaf * 2 : this.leaf, 'front');
      this.#mount(this.backEl, this.spread ? this.leaf * 2 + 1 : this.leaf + 1, 'back');
      // Underneath, the destination right-hand page is already there. Lift a
      // recto in a real book and the next recto is waiting below it, not the
      // sheet in your hand. Leaving the old page here made it look as though the
      // leaf tore a hole in the book as it rose.
      if (this.spread) this.#mount(this.right, this.leaf * 2 + 2, 'right');
    } else {
      // Backward: the leaf being un-turned is the previous one.
      const target = this.leaf - 1;
      this.#mount(this.frontEl, this.spread ? target * 2 : target, 'front');
      this.#mount(this.backEl, this.spread ? target * 2 + 1 : target + 1, 'back');
      // Mirror image: the destination left-hand page waits under the returning leaf.
      if (this.spread) this.#mount(this.left, target * 2 - 1, 'left');
    }
    this.leafEl.style.visibility = 'visible';
  }

  #animate(from, to, dir, done) {
    if (this.motionQuery.matches) { this.#applyAngle(to, dir); done(); return; }

    cancelAnimationFrame(this.animation);
    const start = performance.now();
    const span = Math.abs(to - from) * this.duration;

    const step = (now) => {
      const p = span === 0 ? 1 : Math.min(1, (now - start) / span);
      this.#applyAngle(from + (to - from) * EASE_OUT_CUBIC(p), dir);
      if (p < 1) this.animation = requestAnimationFrame(step);
      else done();
    };
    this.animation = requestAnimationFrame(step);
  }

  // ------------------------------------------------------------------ control

  next() {
    if (this.drag || this.leaf >= this.#lastLeaf()) return;
    this.#arm(1);
    this.#animate(0, 1, 1, () => { this.leaf += 1; this.render(); });
  }

  prev() {
    if (this.drag || this.leaf <= 0) return;
    this.#arm(-1);
    this.#animate(1, 0, -1, () => { this.leaf -= 1; this.render(); });
  }

  goToLeaf(index) {
    const target = Math.max(0, Math.min(this.#lastLeaf(), index));
    if (target === this.leaf) return;
    this.leaf = target;
    this.render();
  }

  #lastLeaf() {
    return this.spread ? this.leafCount - 1 : this.pageCount - 1;
  }

  // --------------------------------------------------------------------- drag

  #onPointerDown(e) {
    if (this.motionQuery.matches || e.button !== 0) return;
    const box = this.book.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;

    // Grab from the outer third of either side, the way a hand finds a corner.
    const dir = x > 0.66 ? 1 : x < 0.34 ? -1 : 0;
    if (!dir) return;
    if (dir > 0 && this.leaf >= this.#lastLeaf()) return;
    if (dir < 0 && this.leaf <= 0) return;

    this.drag = { dir, startX: e.clientX, box, moved: false, t: dir > 0 ? 0 : 1 };
  }

  #onPointerMove(e) {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.startX;
    if (!this.drag.moved) {
      if (Math.abs(dx) < DRAG_SLOP) return;
      this.drag.moved = true;
      this.#arm(this.drag.dir);
      this.book.classList.add('is-dragging');
    }
    // Pointer travel across the active half maps to a full turn.
    const reach = this.drag.box.width * (this.spread ? 0.5 : 1);
    const progress = -dx / reach;
    this.drag.t = Math.max(0, Math.min(1, this.drag.dir > 0 ? progress : 1 + progress));
    this.#applyAngle(this.drag.t, this.drag.dir);
  }

  #onPointerUp() {
    if (!this.drag) return;
    const { dir, t, moved } = this.drag;
    this.book.classList.remove('is-dragging');

    if (!moved) { this.drag = null; return; } // a tap, not a drag

    this.drag = null;
    const committed = dir > 0 ? t > COMMIT_THRESHOLD : t < 1 - COMMIT_THRESHOLD;

    if (committed) {
      this.#animate(t, dir > 0 ? 1 : 0, dir, () => { this.leaf += dir; this.render(); });
    } else {
      // Spring back to where it came from; the page was not committed.
      this.#animate(t, dir > 0 ? 0 : 1, dir, () => this.render());
    }
  }

  #cancelDrag() {
    if (!this.drag) return;
    this.book.classList.remove('is-dragging');
    this.drag = null;
    this.render();
  }

  destroy() {
    cancelAnimationFrame(this.animation);
    this.cache.clear();
    this.root.replaceChildren();
  }
}
