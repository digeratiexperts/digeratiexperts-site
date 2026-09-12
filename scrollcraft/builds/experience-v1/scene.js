/**
 * The DE world — Experience v1, revision 4.
 *
 * Light, line and plane. Nothing else.
 *
 * Revision 3 drew an office: desks as boxes, monitors as planes, people as
 * capsules. Joe's read of it (2026-09-06) was that it sat between "deliberately
 * abstract" and "a rendered environment" and worked as neither, and he was
 * right. So there is no furniture here at all. A person is a point of light. A
 * device is a small lit quad. A cloud system is a pane of glass. The ground is
 * a grid of lines, not a surface. Nothing in this file can read as a greybox
 * model, because nothing in it is a box.
 *
 * Two consequences beyond the look:
 *   - It is far cheaper to draw (no shadow map, no standard materials, no
 *     environment probe), which is what lets phones run it.
 *   - Everything is additive, so overlapping light blooms for free. That is the
 *     premium cue this scene was missing, and it costs nothing.
 *
 * The timeline t is the WHOLE PAGE now, not just the pinned story:
 *
 *   0..1  Unmanaged complexity  points scattered off a grid that is visibly
 *                               there and unmet; threads stop short
 *   1..2  Visible relationships the room turns to glass, threads draw in the
 *                               spine's order, dependencies cross, four amber
 *                               exceptions appear
 *   2..3  Digerati direction    THE PEAK: everything snaps to the grid, gaps
 *                               close, amber goes out, magenta runs the
 *                               identity chains, one boundary completes
 *   3..5  The evidence tail     the corrected world holds, keeps arcing, and
 *                               dims behind the copy. It never cuts to flat.
 *
 * The camera arcs laterally the whole way and REVERSES at t≈3, on the beat
 * where the world corrects. That reversal is the signature move: vertical
 * scroll, lateral world, and one deliberate change of direction placed on the
 * one moment the page exists to deliver.
 *
 * Brand floor: graphite ground, magenta only where DE acts, violet as lighting
 * only, warm points for people. design/BRAND.md, design/IMAGERY.md.
 */
import * as THREE from './assets/vendor/three.module.min.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const r2 = (seed) => rnd(seed) * 2 - 1;
const DEG = Math.PI / 180;

const C = {
  canvas: 0x050312,
  warm: 0xffc79a,     // people
  cool: 0x8fa0ff,     // systems, devices, network
  thread: 0xb9c4ff,   // relationships
  grid: 0x3d3570,     // the ground that is waiting to be met
  magenta: 0xd3126a,  // DE, and only DE
  amber: 0xf2a13a,    // an exception nobody owns
  ink: 0xf2eff5,
};

/* A soft round falloff, used for every point of light in the scene. One
   texture, drawn once, shared: this is the whole "material" budget. */
function glowTexture(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

/* The backdrop: one vertical gradient behind everything, so the frame is never
   flat black and the horizon reads without a wall being modelled. */
function backdropTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0.00, '#05030f');
  grad.addColorStop(0.34, '#0d0a22');
  grad.addColorStop(0.62, '#181140');
  grad.addColorStop(1.00, '#070518');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

/* ------------------------------------------------------------------ thread */
const RADIAL = 5;
class Thread {
  constructor(color, { seg = 34, radius = 0.012, lift = 0.55 } = {}) {
    this.seg = seg; this.radius = radius; this.lift = lift;
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: C.magenta, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.from = new THREE.Vector3(); this.to = new THREE.Vector3(); this.progress = 0; this.curve = null;
  }
  set(from, to) {
    if (this.from.equals(from) && this.to.equals(to) && this.curve) return;
    this.from.copy(from); this.to.copy(to);
    const mid = from.clone().lerp(to, 0.5); mid.y += this.lift;
    this.curve = new THREE.QuadraticBezierCurve3(from.clone(), mid, to.clone());
    const g = new THREE.TubeGeometry(this.curve, this.seg, this.radius, RADIAL, false);
    this.mesh.geometry.dispose(); this.mesh.geometry = g;
    this.setProgress(this.progress);
  }
  setProgress(p) {
    this.progress = clamp01(p);
    this.mesh.geometry.setDrawRange(0, Math.round(this.seg * this.progress) * RADIAL * 6);
    this.mesh.visible = this.progress > 0.001;
  }
  setHead(p, opacity) {
    if (!this.curve) return;
    this.head.material.opacity = opacity;
    this.head.visible = opacity > 0.01;
    if (opacity > 0.01) this.head.position.copy(this.curve.getPoint(clamp01(p)));
  }
}

/* ------------------------------------------------------------------- world */
export function createWorld(canvas, opts = {}) {
  const portrait = () => canvas.clientHeight > canvas.clientWidth;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, opts.maxDpr || 1.5));
  renderer.setClearColor(C.canvas, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C.canvas, 16, 46);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
  const world = new THREE.Group(); scene.add(world);
  const glow = glowTexture();

  // The backdrop is a sphere seen from the inside, not a plane. A plane leaves
  // a hard edge in frame the moment the camera arcs far enough to see past it,
  // and this camera arcs a long way on purpose.
  const backdrop = new THREE.Mesh(
    new THREE.SphereGeometry(46, 24, 16),
    new THREE.MeshBasicMaterial({ map: backdropTexture(), side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  scene.add(backdrop);

  /* ---------------------------------------------------------------- ground */
  // A grid of lines, not a surface. In act 1 it is dim and nothing sits on it;
  // the correction is the moment every point finally meets it.
  const gridMat = new THREE.LineBasicMaterial({ color: C.grid, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  const gridPts = [];
  const EXT = 9, STEP = 1.2;
  for (let x = -EXT; x <= EXT; x += STEP) gridPts.push(new THREE.Vector3(x, 0, -EXT), new THREE.Vector3(x, 0, EXT));
  for (let z = -EXT; z <= EXT; z += STEP) gridPts.push(new THREE.Vector3(-EXT, 0, z), new THREE.Vector3(EXT, 0, z));
  const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPts), gridMat);
  world.add(grid);

  /* --------------------------------------------------------- points of light */
  // People. Warm, soft, unportraited: presence, never a figure.
  const SEATS = [[-3.6, -1.5], [0, -1.5], [3.6, -1.5], [-3.6, 1.2], [0, 1.2], [3.6, 1.2]];
  const PEOPLE = [0, 2, 3, 4];
  const personMat = new THREE.SpriteMaterial({ map: glow, color: C.warm, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const people = PEOPLE.map((seat, i) => {
    const s = new THREE.Sprite(personMat.clone());
    s.scale.setScalar(0.9);
    s.userData = { seat, dx: 0.5 * r2(i + 1), dz: 0.42 * r2(i + 11), phase: rnd(i + 5) * 6.28 };
    world.add(s);
    // the ring that appears when identity is drawn
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.008, 6, 40),
      new THREE.MeshBasicMaterial({ color: C.ink, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.x = Math.PI / 2; world.add(ring); s.userData.ring = ring;
    return s;
  });

  /* ------------------------------------------------------------ device quads */
  // A device is a small lit rectangle standing where a screen would be. It is
  // a plane of light, not a monitor: no bezel, no stand, no desk.
  const deviceMat = new THREE.MeshBasicMaterial({ color: C.cool, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const devices = SEATS.map(([x, z], i) => {
    const g = new THREE.Group();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), deviceMat.clone());
    quad.position.y = 0.86; g.add(quad);
    // a hairline under it: the only thing that implies a surface
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.006),
      new THREE.MeshBasicMaterial({ color: C.cool, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    bar.rotation.x = -Math.PI / 2; bar.position.y = 0.6; g.add(bar);
    g.userData = { x, z, dx: 0.46 * r2(i + 21), dz: 0.36 * r2(i + 31), ry: 0.22 * r2(i + 41), quad: quad.material, bar: bar.material };
    world.add(g); return g;
  });
  const deviceAnchor = (i) => devices[i].localToWorld(new THREE.Vector3(0, 0.86, 0));

  /* ------------------------------------------------------------ glass planes */
  // Cloud systems: panes above the floor. Edges carry them; the fill is almost
  // nothing, so they read as glass rather than as slabs.
  const SLABS = [{ x: -3.6 }, { x: 0 }, { x: 3.6 }];
  const slabs = SLABS.map((s, i) => {
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(2.5, 1.35);
    const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: C.cool, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    fill.rotation.x = -Math.PI / 2; g.add(fill);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: C.cool, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    edge.rotation.x = -Math.PI / 2; g.add(edge);
    g.userData = { x: s.x, y: 3.3, z: -0.15, dy: 0.55 * r2(i + 51), dx: 0.4 * r2(i + 61), rx: 0.13 * r2(i + 71), rz: 0.11 * r2(i + 81), fill: fill.material, edge: edge.material };
    world.add(g); return g;
  });
  const slabAnchor = (i) => slabs[i].localToWorld(new THREE.Vector3(0, 0, 0));

  /* ------------------------------------------------------- data, below floor */
  const vaultGeo = new THREE.PlaneGeometry(7, 3.2);
  const vaultEdge = new THREE.LineSegments(new THREE.EdgesGeometry(vaultGeo), new THREE.LineBasicMaterial({ color: C.cool, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  vaultEdge.rotation.x = -Math.PI / 2; vaultEdge.position.set(0, -0.85, -0.2); world.add(vaultEdge);
  const vaultAnchor = new THREE.Vector3(0, -0.85, -0.2);

  /* ------------------------------------------------------------ network node */
  const netSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: C.cool, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  netSprite.scale.setScalar(0.8); netSprite.position.set(5.4, 1.3, -3.5); world.add(netSprite);
  const swAnchor = new THREE.Vector3(5.4, 1.3, -3.5);

  /* ---------------------------------------------------------------- threads */
  const threads = [];
  const T = (color, o) => { const th = new Thread(color, o); world.add(th.mesh, th.head); threads.push(th); return th; };
  const chains = people.map((p, i) => ({
    up: T(C.thread, { lift: 0.04, seg: 10, radius: 0.009 }),
    down: T(C.thread, { lift: 0.22, radius: 0.011 }),
    cloud: T(C.thread, { lift: 0.85, radius: 0.011 }),
    slab: [0, 2, 1, 0][i],
    gap: 0.68 + 0.18 * rnd(i + 91),
  }));
  const dataT = slabs.map((s, i) => ({ th: T(C.cool, { lift: -0.4, radius: 0.01 }), gap: 0.6 + 0.2 * rnd(i + 101) }));
  const netT = devices.map((d, i) => ({ th: T(C.thread, { lift: 0.14, radius: 0.008 }), gap: 0.7 + 0.2 * rnd(i + 111) }));
  const edgeT = { th: T(C.cool, { lift: 0.4, radius: 0.01 }), gap: 0.55 };
  const custT = [0, 2].map((si, i) => ({ th: T(C.cool, { lift: 1.15, radius: 0.009 }), slab: si, gap: 0.5 + 0.2 * rnd(i + 121) }));
  const outside = new THREE.Vector3(2.5, 1.2, -11.5);
  const outsideCloud = new THREE.Vector3(-4, 6.4, -11.5);

  /* ----------------------------------------------------------- dependencies */
  const depMat = new THREE.LineDashedMaterial({ color: C.cool, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const deps = [
    [() => slabAnchor(0), () => slabAnchor(1)], [() => slabAnchor(1), () => slabAnchor(2)], [() => slabAnchor(0), () => slabAnchor(2)],
    [() => deviceAnchor(0), () => deviceAnchor(5)], [() => deviceAnchor(2), () => deviceAnchor(3)], [() => deviceAnchor(1), () => slabAnchor(2)],
  ].map(([a, b]) => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a(), b()]), depMat);
    l.userData = { a, b }; l.computeLineDistances(); world.add(l); return l;
  });

  /* -------------------------------------------------------------- boundaries */
  const loop = (pts, color, opacity) => {
    const curve = new THREE.CatmullRomCurve3([...pts, pts[0]], false, 'catmullrom', 0);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(96));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    l.userData.total = 97; world.add(l); return l;
  };
  const rect = (x0, z0, x1, z1, y) => [new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z0), new THREE.Vector3(x1, y, z1), new THREE.Vector3(x0, y, z1)];
  const bounds = [
    loop(rect(-5.0, -2.6, 5.0, 2.4, 0.02), C.cool, 0),
    loop(rect(4.7, -4.4, 6.1, -2.6, 0.02), C.cool, 0),
    loop(rect(-5.2, -1.1, 5.2, 0.8, 3.0), C.cool, 0),
  ];
  const perimeter = loop(rect(-7.2, -4.8, 7.2, 4.8, 0.015), C.magenta, 0);
  const setLoop = (l, frac, opacity) => {
    l.geometry.setDrawRange(0, Math.max(0, Math.round(l.userData.total * clamp01(frac))));
    l.material.opacity = opacity; l.visible = opacity > 0.01 && frac > 0.01;
  };

  /* -------------------------------------------------------------- exceptions */
  const EXC = [
    { at: () => vaultAnchor.clone().add(new THREE.Vector3(2.4, 0.12, 1.2)) },
    { at: () => deviceAnchor(1).add(new THREE.Vector3(0, 0.34, 0)) },
    { at: () => slabAnchor(0).add(new THREE.Vector3(0.9, 0.28, 0.4)) },
    { at: () => netSprite.position.clone().add(new THREE.Vector3(0, 0.5, 0)) },
  ];
  const excs = EXC.map((e) => {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.009, 6, 32),
      new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.rotation.x = Math.PI / 2; m.scale.setScalar(0.001); m.userData = e; world.add(m); return m;
  });

  /* ------------------------------------------------------- camera, laterally */
  // Polar keyframes so the arc is a real orbit, not a lerp between two points.
  // theta sweeps RIGHT -> LEFT through the story, then REVERSES at the
  // correction and travels back right through the evidence tail. That reversal
  // is the signature move and it is placed on the peak, deliberately.
  const KEYS = [
    // t,   theta°, radius, height, lookY
    [0.0,    34,    11.4,   2.6,   0.80],
    [1.0,    14,    10.8,   4.4,   0.85],
    [2.0,   -10,    10.6,   6.2,   0.90],
    [3.0,     5,    11.2,   5.5,   0.90],   // the reversal
    [5.0,    29,    13.6,   6.4,   0.80],
  ];
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  function cameraAt(t) {
    let i = 0; while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const k = smooth((t - a[0]) / (b[0] - a[0]));
    const theta = lerp(a[1], b[1], k) * DEG;
    let radius = lerp(a[2], b[2], k);
    const height = lerp(a[3], b[3], k);
    const lookY = lerp(a[4], b[4], k);
    if (portrait()) radius *= 1.26;           // the whole floor has to fit a phone
    camPos.set(Math.sin(theta) * radius, height, Math.cos(theta) * radius);
    // On a wide screen the copy owns the left column, so look left of centre and
    // the world composes into the right two thirds. On a phone it is centred.
    camLook.set(portrait() ? 0 : -1.7, lookY, -0.3);
  }

  /* ------------------------------------------------------------------ update */
  const anchors = {};
  let idle = 0;
  const v = new THREE.Vector3();
  const tmpCol = new THREE.Color();

  function update(t, dt = 0.016) {
    t = Math.max(0, Math.min(4.999, t)); idle += dt;

    /* the dials */
    const disorder = 1 - ramp(t, 2.10, 2.62);   // 1 -> 0 : the world meets the grid
    const reveal = ramp(t, 1.02, 1.42);         // relationships
    const depR = ramp(t, 1.36, 1.56);           // dependencies
    const bndR = ramp(t, 1.56, 1.80);           // boundaries
    const excR = ramp(t, 1.72, 1.94);           // exceptions
    const de = ramp(t, 2.24, 2.66);             // DE enters
    const settle = ramp(t, 2.60, 3.00);         // calm after the correction
    const glass = ramp(t, 1.00, 1.30);          // the room turns to glass
    const tail = ramp(t, 3.02, 4.05);           // the evidence sections take over
    const close = 1 - disorder;

    /* placement: scattered -> on the grid */
    people.forEach((s, i) => {
      const u = s.userData, seat = SEATS[u.seat];
      const breathe = 0.045 * Math.sin(idle * 0.9 + u.phase);
      s.position.set(seat[0] + u.dx * disorder, 1.05 + breathe, seat[1] + 0.55 + u.dz * disorder);
      s.material.opacity = lerp(0.95, 0.34, tail);
      s.scale.setScalar(lerp(0.9, 0.98, reveal) + 0.03 * Math.sin(idle * 0.7 + u.phase));
      const ring = u.ring;
      ring.position.set(s.position.x, s.position.y - 0.02, s.position.z);
      ring.scale.setScalar(Math.max(0.001, reveal));
      tmpCol.setHex(C.ink).lerp(new THREE.Color(C.magenta), de * (1 - settle * 0.75));
      ring.material.color.copy(tmpCol);
      ring.material.opacity = reveal * lerp(0.55, 0.14, tail);
    });

    devices.forEach((g, i) => {
      const u = g.userData;
      g.position.set(u.x + u.dx * disorder, 0, u.z + u.dz * disorder);
      g.rotation.y = u.ry * disorder;
      const on = ramp(t, i * 0.02 - 0.02, i * 0.02 + 0.16);
      u.quad.opacity = on * lerp(0.5, 0.34, glass) * lerp(1, 0.3, tail);
      u.bar.opacity = on * 0.5 * lerp(1, 0.26, tail);
    });

    slabs.forEach((g) => {
      const u = g.userData;
      g.position.set(u.x + u.dx * disorder, u.y + u.dy * disorder, u.z);
      g.rotation.set(u.rx * disorder, 0, u.rz * disorder);
      u.fill.opacity = lerp(0.05, 0.1, reveal) * lerp(1, 0.3, tail);
      u.edge.opacity = lerp(0.34, 0.62, reveal) * lerp(1, 0.26, tail);
    });

    // the grid brightens as the world approaches it, and is brightest the
    // instant everything lands on it
    // The grid is visible from the first frame: it is the order the world has
    // not met yet, so it has to be legible before the correction, not after.
    gridMat.opacity = (0.26 + 0.26 * close + 0.08 * reveal) * lerp(1, 0.26, tail);

    vaultEdge.material.opacity = lerp(0, 0.55, ramp(t, 1.18, 1.42)) * lerp(1, 0.24, tail);
    netSprite.material.opacity = lerp(0, 0.8, reveal) * lerp(1, 0.26, tail);

    /* threads */
    chains.forEach((c, i) => {
      const p = people[i], ring = p.userData.ring;
      const top = v.set(p.position.x, p.position.y + 0.1, p.position.z).clone();
      const ringP = ring.position.clone();
      const dev = deviceAnchor(p.userData.seat);
      const slab = slabAnchor(c.slab);
      c.up.set(top, ringP); c.down.set(ringP, dev); c.cloud.set(dev, slab);
      const g = lerp(c.gap, 1, close);
      c.up.setProgress(ramp(t, 1.03 + i * 0.03, 1.13 + i * 0.03));
      c.down.setProgress(ramp(t, 1.10 + i * 0.03, 1.22 + i * 0.03) * g);
      c.cloud.setProgress(ramp(t, 1.18 + i * 0.03, 1.32 + i * 0.03) * g);
      const run = ramp(t, 2.26 + i * 0.05, 2.56 + i * 0.05);
      c.down.setHead(run, run > 0 && run < 1 ? 1 : 0);
      c.cloud.setHead(ramp(t, 2.40 + i * 0.05, 2.68 + i * 0.05), run >= 1 && settle < 1 ? 0.9 : 0);
      tmpCol.setHex(C.thread).lerp(new THREE.Color(C.magenta), de * (1 - settle) * 0.85).lerp(new THREE.Color(C.ink), settle * 0.6);
      const op = lerp(0.9, 0.2, tail);
      [c.up, c.down, c.cloud].forEach((th) => { th.mat.color.copy(tmpCol); th.mat.opacity = op; });
    });

    dataT.forEach((d, i) => {
      d.th.set(slabAnchor(i), vaultAnchor.clone().add(new THREE.Vector3((i - 1) * 2.2, 0, 0)));
      d.th.setProgress(ramp(t, 1.18 + i * 0.03, 1.30 + i * 0.03) * lerp(d.gap, 1, close));
      d.th.mat.opacity = lerp(0.75, 0.16, tail);
    });

    // In act 1 the network threads are stubs that reach toward the node and
    // stop: connections that almost meet, before anything is named.
    const stub = 0.15 * ramp(t, 0.18, 0.55) * (1 - reveal);
    netT.forEach((n, i) => {
      n.th.set(deviceAnchor(i), swAnchor);
      n.th.setProgress(Math.max(stub * (0.6 + 0.4 * rnd(i + 131)), ramp(t, 1.24 + i * 0.02, 1.36 + i * 0.02) * lerp(n.gap, 1, close)));
      n.th.mat.opacity = lerp(0.24, 0.8, reveal) * lerp(1, 0.2, tail);
      tmpCol.setHex(C.thread).lerp(new THREE.Color(C.ink), settle * 0.5);
      n.th.mat.color.copy(tmpCol);
    });

    edgeT.th.set(swAnchor, outside);
    edgeT.th.setProgress(ramp(t, 1.28, 1.42) * lerp(edgeT.gap, 1, close));
    edgeT.th.mat.opacity = lerp(0.7, 0.15, tail);
    custT.forEach((c, i) => {
      c.th.set(outsideCloud.clone().add(new THREE.Vector3(i * 3, 0, 0)), slabAnchor(c.slab));
      c.th.setProgress(ramp(t, 1.32 + i * 0.03, 1.46 + i * 0.03) * lerp(c.gap, 1, close));
      c.th.mat.opacity = lerp(0.7, 0.15, tail);
    });

    /* dependencies, boundaries, exceptions */
    deps.forEach((l) => {
      const pos = l.geometry.attributes.position, a = l.userData.a(), b = l.userData.b();
      pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z);
      pos.needsUpdate = true; l.computeLineDistances();
    });
    depMat.opacity = 0.5 * depR * (1 - settle * 0.8) * lerp(1, 0.2, tail);
    depMat.visible = depMat.opacity > 0.01;

    bounds.forEach((b, i) => setLoop(b, lerp(0.42 + 0.1 * i, 1, close), 0.45 * ramp(t, 1.56 + i * 0.06, 1.70 + i * 0.06) * lerp(1, 0.22, tail)));
    // the one boundary DE is accountable for, and it is the last thing to close
    setLoop(perimeter, ramp(t, 2.44, 2.80), 0.8 * ramp(t, 2.44, 2.60) * lerp(1, 0.3, tail));

    excs.forEach((m, i) => {
      m.position.copy(m.userData.at());
      const s = ramp(t, 1.72 + i * 0.05, 1.84 + i * 0.05) * (1 - ramp(t, 2.34 + i * 0.05, 2.58 + i * 0.05));
      m.scale.setScalar(Math.max(0.001, s));
      m.material.opacity = 0.9 * s * (0.75 + 0.25 * Math.sin(idle * 2.2 + i));
    });

    /* the frame itself dims as the evidence takes over, so the copy always wins */
    backdrop.material.opacity = 1;
    backdrop.material.color.setScalar(lerp(1, 0.42, tail));
    scene.fog.near = lerp(16, 12, tail);
    scene.fog.far = lerp(46, 34, tail);

    /* camera */
    cameraAt(t);
    camera.position.copy(camPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(camLook);

    /* anchors for the DOM labels */
    anchors.identity = people[0].userData.ring.position.clone().add(new THREE.Vector3(0, 0.3, 0));
    anchors.devices = deviceAnchor(0).add(new THREE.Vector3(0, 0.34, 0));
    anchors.email = slabAnchor(0).add(new THREE.Vector3(-0.9, 0.3, 0));
    anchors.data = vaultAnchor.clone().add(new THREE.Vector3(-2.6, 0, 1.3));
    anchors.network = swAnchor.clone().add(new THREE.Vector3(0, 0.5, 0));
    anchors.applications = slabAnchor(1).add(new THREE.Vector3(1.05, 0.3, -0.55));
    anchors.customers = outsideCloud.clone().add(new THREE.Vector3(1.5, -0.6, 0));
    anchors.vendor0 = slabAnchor(0).add(new THREE.Vector3(1.0, -0.2, 0.8));
    anchors.vendor1 = slabAnchor(2).add(new THREE.Vector3(1.0, -0.2, 0.8));
    anchors.vendor2 = swAnchor.clone().add(new THREE.Vector3(0.2, 0.95, 0));
    excs.forEach((m, i) => { anchors['exc' + i] = m.position.clone().add(new THREE.Vector3(0, 0.24, 0)); });
    anchors.de = people[1].userData.ring.position.clone().add(new THREE.Vector3(0.2, 0.6, 0));

    return { disorder, reveal, depR, bndR, excR, de, settle, tail };
  }

  function project(vec, out) {
    v.copy(vec).project(camera);
    out.x = (v.x * 0.5 + 0.5) * canvas.clientWidth;
    out.y = (-v.y * 0.5 + 0.5) * canvas.clientHeight;
    out.behind = v.z > 1; return out;
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = portrait() ? 52 : 42; camera.updateProjectionMatrix();
  }
  function render() { renderer.render(scene, camera); }

  resize();
  return { update, render, resize, project, anchors, renderer, dispose: () => renderer.dispose() };
}
