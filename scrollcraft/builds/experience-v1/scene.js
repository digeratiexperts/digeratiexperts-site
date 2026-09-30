/**
 * The DE world — Experience v1, flagship prototype.
 *
 * One environment, built in code, that every act transforms. Nothing here is
 * text and nothing here is a photograph: a floor, desks, screens, people as
 * presence, three cloud slabs, a vault, a closet, an access point, and the
 * threads that connect them. The scene is a pure function of the timeline
 * t ∈ [0, 4):
 *
 *   0..1  Act 1  Disconnected: everything exists, nothing lines up (1.2° off)
 *   1..2  Act 2  What's underneath: relationships, dependencies, vendors,
 *                boundaries, exceptions
 *   2..3  Act 3  The heading is wrong → the operating principle → the world
 *                corrects; DE enters as the navigator
 *   3..4  Coda   DE sees the whole environment (first state of Act 4)
 *
 * Brand floor: graphite ground, magenta only where DE acts, violet as lighting
 * only, warm dawn → cool exposure → clean level light. design/BRAND.md,
 * design/IMAGERY.md ("the idea, not the literal noun").
 */
import * as THREE from './assets/vendor/three.module.min.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const r2 = (seed) => rnd(seed) * 2 - 1;

const C = {
  canvas: 0x050312, floor: 0x2a2450, wall: 0x1c1636, desk: 0x3a3262, closet: 0x2a2450,
  screen: 0xcfd8ff, warm: 0xffb27a, violet: 0x5b45e0, magenta: 0xd3126a, amber: 0xf2a13a,
  ink: 0xf2eff5, cool: 0x8fa0ff, thread: 0xb9c4ff,
};

/* ------------------------------------------------------------ materials */
function fresnel(color, { power = 2.6, intensity = 1.3, base = 0.06, additive = true, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power }, uIntensity: { value: intensity }, uBase: { value: base }, uOpacity: { value: 1 },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uPower, uIntensity, uBase, uOpacity; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), uPower); float k = uBase + f * uIntensity; gl_FragColor = vec4(uColor * k, k * uOpacity); }`,
    transparent: true, depthWrite: false, side,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function gradientTexture(stops, w = 2, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const grad = g.createLinearGradient(0, h, 0, 0);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

/** A screen: a cool interface gradient with two faint bands, never a logo. */
function screenTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 80);
  grad.addColorStop(0, '#c9d3ff'); grad.addColorStop(0.55, '#8d9ce6'); grad.addColorStop(1, '#5b67b3');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 80);
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(10, 12, 62, 6); g.fillRect(10, 26, 92, 4); g.fillRect(10, 36, 74, 4);
  g.fillStyle = 'rgba(20,16,40,0.35)'; g.fillRect(0, 0, 128, 8);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

/**
 * A procedural environment: a dark room with one warm wall (the window) and a
 * faint cool ceiling. Gives every standard material a sheen to reflect, which
 * is most of what separates "lit object" from "coloured box".
 */
function roomEnvironment() {
  const size = 64;
  const face = (top, bottom, mid) => {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, top); if (mid) grad.addColorStop(0.5, mid); grad.addColorStop(1, bottom);
    g.fillStyle = grad; g.fillRect(0, 0, size, size); return c;
  };
  const faces = [
    face('#1a1630', '#0a0716'),            // +x
    face('#3a2214', '#7a4322', '#5a301a'), // -x : the window wall, warm
    face('#2a2444', '#2a2444'),            // +y : ceiling, cool
    face('#06040c', '#06040c'),            // -y : floor
    face('#141026', '#0a0716'),            // +z
    face('#100c20', '#0a0716'),            // -z
  ];
  const tex = new THREE.CubeTexture(faces); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  return tex;
}

/* --------------------------------------------------------------- thread */
const RADIAL = 5;
class Thread {
  constructor(color, { seg = 40, radius = 0.014, lift = 0.55, additive = true } = {}) {
    this.seg = seg; this.radius = radius; this.lift = lift;
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: C.magenta, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
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

/* ----------------------------------------------------------------- world */
export function createWorld(canvas, opts = {}) {
  const portrait = () => canvas.clientHeight > canvas.clientWidth;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, opts.maxDpr || 1.5));
  renderer.setClearColor(C.canvas, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = !!opts.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C.canvas, 20, 44);
  scene.environment = roomEnvironment();
  scene.environmentIntensity = 0.85;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  const world = new THREE.Group(); scene.add(world);

  /* lights */
  const sun = new THREE.DirectionalLight(C.warm, 3.2); sun.position.set(-7, 4.5, 2.5); sun.target.position.set(1, 0, -1);
  scene.add(sun, sun.target);
  if (opts.shadows) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const s = sun.shadow.camera; s.left = -9; s.right = 9; s.top = 8; s.bottom = -8; s.near = 1; s.far = 30; sun.shadow.bias = -0.0008; }
  const ambient = new THREE.AmbientLight(C.violet, 0.6); scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0x4a4270, 0x14102a, 1.3); scene.add(hemi);
  const closetLight = new THREE.PointLight(C.cool, 0, 7, 2); closetLight.position.set(5.2, 1.6, -3.4); scene.add(closetLight);
  const deLight = new THREE.PointLight(C.magenta, 0, 9, 2); deLight.position.set(0, 2.2, 0); scene.add(deLight);
  // a warm practical near the door so the opening frame has a lit foreground
  const doorLight = new THREE.PointLight(0xffc48a, 6, 9, 2); doorLight.position.set(1.2, 2.4, 3.2); scene.add(doorLight);

  /* floor, walls, window */
  const floorMat = new THREE.MeshStandardMaterial({ color: C.floor, roughness: 0.62, metalness: 0.12, envMapIntensity: 0.9, transparent: true, opacity: 1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; world.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: C.wall, roughness: 0.95, transparent: true, opacity: 1 });
  const farWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.2), wallMat); farWall.position.set(0, 1.6, -4.5); world.add(farWall);
  const windowTex = gradientTexture([[0, '#3b2416'], [0.35, '#6a3a1e'], [0.7, '#20172e'], [1, '#0a0716']]);
  const windowMat = new THREE.MeshBasicMaterial({ map: windowTex, transparent: true, opacity: 1 });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 3.2), windowMat); win.position.set(-7.02, 1.6, -0.2); win.rotation.y = Math.PI / 2; world.add(win);
  // outside: the horizon beyond the far wall
  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.03), new THREE.MeshBasicMaterial({ color: C.cool, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
  horizon.position.set(0, 0.9, -10.5); world.add(horizon);

  // No door frame, chairs, keyboards or phones: since Joe's 2026-09-03 verdict
  // the world leans deliberately abstract, a lit model of a business rather
  // than a furniture render.

  /* desks: base grid + per-desk disorder */
  const DESKS = [[-3.6, -1.5], [0, -1.5], [3.6, -1.5], [-3.6, 1.2], [0, 1.2], [3.6, 1.2]];
  const deskMat = new THREE.MeshStandardMaterial({ color: C.desk, roughness: 0.38, metalness: 0.2, envMapIntensity: 0.8 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x110e1c, roughness: 0.6, metalness: 0.3 });
  const standMat = new THREE.MeshStandardMaterial({ color: 0x0c0a14, roughness: 0.5, metalness: 0.4 });
  const screenTex = screenTexture();
  // A desk is a plinth: one slab on two blades and a lit screen with a bezel.
  const desks = DESKS.map(([x, z], i) => {
    const g = new THREE.Group(); g.userData = { x, z, dx: 0.38 * r2(i + 1), dz: 0.3 * r2(i + 11), ry: 0.16 * r2(i + 21) };
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.86), deskMat); top.position.y = 0.74; top.castShadow = top.receiveShadow = true; g.add(top);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.7), legMat); legL.position.set(-0.78, 0.36, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.78; g.add(legR);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.1), standMat); stand.position.set(0, 0.87, -0.24); g.add(stand);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.015, 0.2), standMat); foot.position.set(0, 0.775, -0.22); g.add(foot);
    // screens: a lit interface with depth (bezel behind), never a white card
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, opacity: 0.0 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.36), screenMat); screen.position.set(0, 1.16, -0.2); screen.rotation.x = -0.1; g.add(screen);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.42, 0.025), standMat); bezel.position.set(0, 1.16, -0.214); bezel.rotation.x = -0.1; g.add(bezel);
    g.userData.screen = screenMat;
    world.add(g); return g;
  });
  const deskScreenAnchor = (i) => { const v = new THREE.Vector3(0, 1.13, -0.2); return desks[i].localToWorld(v); };

  /* meeting table, closet, access point */
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 1.05), deskMat); table.position.set(0.3, 0.74, -3.3); table.castShadow = table.receiveShadow = true; world.add(table);
  const tableBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), legMat); tableBase.position.set(0.3, 0.36, -3.3); world.add(tableBase);
  const closet = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.0, 0.6), new THREE.MeshStandardMaterial({ color: C.closet, roughness: 0.5, metalness: 0.2 })); closet.position.set(5.6, 1.0, -3.95); closet.castShadow = true; world.add(closet);
  const switchMat = new THREE.MeshBasicMaterial({ color: C.cool, transparent: true, opacity: 0.15 });
  const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.08), switchMat); sw.position.set(5.6, 1.35, -3.64); world.add(sw);
  const swAnchor = new THREE.Vector3(5.6, 1.35, -3.6);
  const apGroup = new THREE.Group(); apGroup.userData = { x: 0, z: -0.1, dx: 0.7, dz: 0.5 };
  const ap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x2b2640, roughness: 0.5 })); ap.position.y = 2.95; apGroup.add(ap);
  const apRingMat = fresnel(C.cool, { power: 1.6, intensity: 1.0, base: 0.15 });
  const apRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.01, 8, 48), apRingMat); apRing.rotation.x = Math.PI / 2; apRing.position.y = 2.9; apGroup.add(apRing);
  world.add(apGroup);

  /* people as presence */
  const personMat = fresnel(0xffe7d2, { power: 2.2, intensity: 1.15, base: 0.05 });
  const PEOPLE = [
    { seat: 3, x: -3.6, z: 1.75, y: 0.95 },          // P1 at desk 4 (near-left), seated
    { seat: 2, x: 3.6, z: -0.95, y: 0.95 },          // P2 at desk 3 (far-right), seated
    { seat: -1, x: 0.3, z: -2.6, y: 0.95 },          // P3 at the table
    { seat: 4, x: -2.4, z: 3.4, y: 1.06, walker: true }, // P4 walks in from the side and sits at desk 5 (near-middle)
  ];
  const people = PEOPLE.map((p) => {
    // a figure, not a pill: shoulders and a head, both as presence
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.4, 6, 14), personMat); m.position.set(p.x, p.y, p.z); m.userData = p; world.add(m);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), personMat); head.position.y = 0.5; m.add(head);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 8, 48), fresnel(C.ink, { power: 1.4, intensity: 1.2, base: 0.25 }));
    ring.rotation.x = Math.PI / 2; ring.scale.setScalar(0.001); world.add(ring); m.userData.ring = ring; return m;
  });

  /* cloud slabs: present from the first frame, misaligned */
  const slabMat = new THREE.MeshStandardMaterial({ color: C.cool, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false });
  const edgeMat = new THREE.LineBasicMaterial({ color: C.cool, transparent: true, opacity: 0.7 });
  const SLABS = [{ x: -3.6, name: 'email' }, { x: 0, name: 'apps' }, { x: 3.6, name: 'system' }];
  const slabs = SLABS.map((s, i) => {
    const g = new THREE.Group(); g.userData = { x: s.x, y: 3.35, z: -0.15, dy: 0.5 * r2(i + 31), rx: 0.11 * r2(i + 41), rz: 0.09 * r2(i + 51), dx: 0.25 * r2(i + 61), name: s.name };
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.3), slabMat); g.add(box);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), edgeMat); g.add(edges);
    world.add(g); return g;
  });
  const slabAnchor = (i) => slabs[i].localToWorld(new THREE.Vector3(0, -0.03, 0));

  /* the vault below the floor */
  const vaultMat = new THREE.MeshStandardMaterial({ color: 0x6f7fcc, roughness: 0.3, transparent: true, opacity: 0, depthWrite: false });
  const vault = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 3.4), vaultMat); vault.position.set(0, -0.78, -0.2); world.add(vault);
  const vaultEdges = new THREE.LineSegments(new THREE.EdgesGeometry(vault.geometry), new THREE.LineBasicMaterial({ color: C.cool, transparent: true, opacity: 0 })); vaultEdges.position.copy(vault.position); world.add(vaultEdges);
  const vaultAnchor = new THREE.Vector3(0, -0.53, -0.2);

  /* threads */
  const threads = [];
  const T = (color, o) => { const th = new Thread(color, o); world.add(th.mesh, th.head); threads.push(th); return th; };
  // identity chain per person: person → ring → device ; device → slab
  const chains = people.map((p, i) => ({
    up: T(C.thread, { lift: 0.05, seg: 12 }),
    down: T(C.thread, { lift: 0.25 }),
    cloud: T(C.thread, { lift: 0.9 }),
    slab: [0, 2, 1, 0][i],
    gap: 0.72 + 0.16 * rnd(i + 71),
  }));
  const dataT = slabs.map((s, i) => ({ th: T(C.cool, { lift: -0.4 }), gap: 0.6 + 0.2 * rnd(i + 81) }));
  const netT = desks.map((d, i) => ({ th: T(C.thread, { lift: 0.15, radius: 0.011 }), gap: 0.7 + 0.2 * rnd(i + 91) }));
  const edgeT = { th: T(C.cool, { lift: 0.4 }), gap: 0.55 };
  const custT = [0, 2].map((si, i) => ({ th: T(C.cool, { lift: 1.2 }), slab: si, gap: 0.5 + 0.2 * rnd(i + 101) }));
  const outside = new THREE.Vector3(2.5, 1.2, -10.4);
  const outsideCloud = new THREE.Vector3(-4, 6.5, -10.4);

  /* dependencies: dashed crossings */
  const depMat = new THREE.LineDashedMaterial({ color: C.cool, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0 });
  const deps = [[() => slabAnchor(0), () => slabAnchor(1)], [() => slabAnchor(1), () => slabAnchor(2)], [() => slabAnchor(0), () => slabAnchor(2)],
    [() => deskScreenAnchor(0), () => deskScreenAnchor(5)], [() => deskScreenAnchor(2), () => deskScreenAnchor(3)], [() => deskScreenAnchor(1), () => slabAnchor(2)]]
    .map(([a, b]) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a(), b()]), depMat); l.userData = { a, b }; l.computeLineDistances(); world.add(l); return l; });

  /* boundaries: loops around the desk cluster, the closet, the slabs, and the perimeter (DE's) */
  const loop = (pts, color, opacity) => {
    const closed = [...pts, pts[0]];
    const curve = new THREE.CatmullRomCurve3(closed, false, 'catmullrom', 0);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(96));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    l.userData.total = 97; world.add(l); return l;
  };
  const rect = (x0, z0, x1, z1, y) => [new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z0), new THREE.Vector3(x1, y, z1), new THREE.Vector3(x0, y, z1)];
  const bounds = [
    loop(rect(-5.0, -2.6, 5.0, 2.4, 0.03), C.cool, 0),
    loop(rect(4.9, -4.5, 6.3, -3.3, 0.03), C.cool, 0),
    loop(rect(-5.2, -1.1, 5.2, 0.8, 3.0), C.cool, 0),
  ];
  const perimeter = loop(rect(-6.9, -4.45, 6.9, 4.45, 0.02), C.magenta, 0);
  const setLoop = (l, frac, opacity) => { l.geometry.setDrawRange(0, Math.max(0, Math.round(l.userData.total * clamp01(frac)))); l.material.opacity = opacity; l.visible = opacity > 0.01 && frac > 0.01; };

  /* exceptions: hollow amber markers at four weak points */
  const excMat = fresnel(C.amber, { power: 1.2, intensity: 1.3, base: 0.3 });
  const EXC = [
    { at: () => vaultAnchor.clone().add(new THREE.Vector3(2.4, 0.1, 1.2)), label: 'backup untested', m: false },
    { at: () => deskScreenAnchor(1).add(new THREE.Vector3(0, 0.35, 0)), label: 'unpatched', m: true },
    { at: () => slabAnchor(0).add(new THREE.Vector3(0.9, 0.3, 0.4)), label: 'shared mailbox', m: false },
    { at: () => apGroup.localToWorld(new THREE.Vector3(0, 3.25, 0)), label: 'guest network open', m: true },
  ];
  const excs = EXC.map((e) => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 32), excMat); m.rotation.x = Math.PI / 2; m.scale.setScalar(0.001); world.add(m); m.userData = e; return m; });

  /* ----------------------------------------------------- camera keyframes */
  const KEYS = [
    [0.0, [3.3, 2.7, 5.9], [0.3, 0.9, -1.0]],   // the establishing view: the whole floor, three-quarter, slightly low
    [0.9, [3.9, 3.5, 6.3], [0.2, 1.0, -0.9]],
    [1.35, [4.6, 4.8, 7.1], [0.2, 1.2, -0.6]],
    [1.95, [5.7, 6.5, 7.6], [0.0, 1.3, -0.4]],
    [2.45, [5.7, 6.5, 7.6], [0.0, 1.3, -0.4]],
    [3.05, [5.2, 5.9, 6.9], [0.0, 1.3, -0.3]],
    [3.95, [7.2, 8.2, 9.6], [0.0, 1.2, -0.3]],
  ];
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function cameraAt(t) {
    let i = 0; while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
    const [ta, pa, la] = KEYS[i], [tb, pb, lb] = KEYS[i + 1];
    const k = smooth((t - ta) / (tb - ta));
    camPos.set(...pa).lerp(tmpA.set(...pb), k); camLook.set(...la).lerp(tmpB.set(...lb), k);
    if (portrait()) { // further back and higher so the whole floor fits a portrait frame
      tmpA.copy(camPos).sub(camLook).multiplyScalar(1.3); camPos.copy(camLook).add(tmpA); camLook.y += 0.1;
    } else {
      // the copy owns the left column on a wide screen: look left of the
      // room's centre so the room itself sits in the right two thirds
      camLook.x -= 1.6;
    }
  }

  /* ---------------------------------------------------------------- update */
  const anchors = {};
  let idleClock = 0;
  const upVec = new THREE.Vector3();
  const v = new THREE.Vector3();

  function update(t, dt = 0.016) {
    t = Math.max(0, Math.min(3.999, t)); idleClock += dt;
    /* the four dials of the story */
    const disorder = 1 - ramp(t, 2.45, 2.88);          // 1 → 0 : the world corrects
    // heading off true, then level: 2° reads in a still and on a phone; the
    // #186 passage used 1.2° on type, where the eye is more sensitive
    const tilt = -(portrait() ? 1.4 : 2.0) * (Math.PI / 180) * disorder;
    const reveal = ramp(t, 1.02, 1.42);                // relationships
    const depR = ramp(t, 1.38, 1.56);                  // dependencies
    const bndR = ramp(t, 1.58, 1.82);                  // boundaries
    const excR = ramp(t, 1.74, 1.96);                  // exceptions
    const de = ramp(t, 2.55, 2.92);                    // DE enters
    const settle = ramp(t, 2.85, 3.25);                // hierarchy, calm
    const glass = ramp(t, 1.0, 1.3);

    /* placement: disorder → grid */
    desks.forEach((g) => { const u = g.userData; g.position.set(u.x + u.dx * disorder, 0, u.z + u.dz * disorder); g.rotation.y = u.ry * disorder; });
    slabs.forEach((g) => { const u = g.userData; g.position.set(u.x + u.dx * disorder, u.y + u.dy * disorder, u.z); g.rotation.set(u.rx * disorder, 0, u.rz * disorder); });
    apGroup.position.set(apGroup.userData.dx * disorder, 0, apGroup.userData.dz * disorder);

    /* people: the walker comes in and sits */
    people.forEach((m) => {
      const p = m.userData;
      if (p.walker) {
        const w = ramp(t, 0.12, 0.82);
        const seat = desks[p.seat].position;
        m.position.set(lerp(p.x, seat.x, w), lerp(1.06, 0.95, ramp(t, 0.78, 0.9)), lerp(p.z, seat.z + 0.55, w));
      } else if (p.seat >= 0) { const s = desks[p.seat].position; m.position.set(s.x, p.y, s.z + 0.55); }
      m.material.uniforms.uIntensity.value = 1.15 + 0.1 * Math.sin(idleClock * 0.8 + p.x);
      const ring = p.ring; ring.position.set(m.position.x, m.position.y + 0.82, m.position.z);
      const rs = reveal; ring.scale.setScalar(Math.max(0.001, rs));
      ring.material.uniforms.uColor.value.setHex(C.ink).lerp(new THREE.Color(C.magenta), de * (1 - settle * 0.8));
      ring.material.uniforms.uIntensity.value = 1.2 + de * 1.2 - settle * 0.6;
    });

    /* screens flicker on through act 1, then hold; the closet lights in act 2 */
    desks.forEach((g, i) => {
      // the first screens are already on in the frame at rest; the rest wake as the camera moves
      const on = 1; // every screen is lit from the first frame: the establishing view shows the whole floor
      const flick = t < 0.5 ? 0.85 + 0.15 * Math.abs(Math.sin(idleClock * 23 + i * 7)) : 1;
      g.userData.screen.opacity = on * flick * lerp(0.92, 0.7, glass);
    });
    switchMat.opacity = lerp(0.12, 0.9, reveal) ; closetLight.intensity = lerp(0, 5, reveal) * (1 - 0.3 * disorder);
    horizon.material.opacity = lerp(0, 0.55, ramp(t, 1.2, 1.5));

    /* materials: the room becomes dark glass in act 2 */
    floorMat.opacity = lerp(1, 0.34, glass); floorMat.color.setHex(C.floor).lerp(new THREE.Color(0x121734), glass);
    wallMat.opacity = lerp(1, 0.2, glass); windowMat.opacity = lerp(1, 0.55, glass);
    vaultMat.opacity = lerp(0, 0.36, ramp(t, 1.2, 1.4)); vaultEdges.material.opacity = lerp(0, 0.85, ramp(t, 1.2, 1.4));
    slabMat.opacity = lerp(0.18, 0.26, reveal); edgeMat.opacity = lerp(0.6, 0.85, reveal);

    /* threads: draw in layers, stop short while disordered, close when the world corrects */
    const close = 1 - disorder;
    chains.forEach((c, i) => {
      const person = people[i], ring = person.userData.ring;
      const top = v.set(person.position.x, person.position.y + 0.62, person.position.z).clone();
      const ringP = ring.position.clone();
      const dev = deskScreenAnchor(person.userData.seat >= 0 ? person.userData.seat : 1);
      const slab = slabAnchor(c.slab);
      c.up.set(top, ringP); c.down.set(ringP, dev); c.cloud.set(dev, slab);
      const g = lerp(c.gap, 1, close);
      c.up.setProgress(ramp(t, 1.03 + i * 0.03, 1.13 + i * 0.03));
      c.down.setProgress(ramp(t, 1.1 + i * 0.03, 1.22 + i * 0.03) * g);
      c.cloud.setProgress(ramp(t, 1.18 + i * 0.03, 1.32 + i * 0.03) * g);
      // DE enters: a magenta head runs the identity chain, then the threads brighten
      const run = ramp(t, 2.56 + i * 0.05, 2.86 + i * 0.05);
      c.down.setHead(run, run > 0 && run < 1 ? 1 : 0);
      c.cloud.setHead(ramp(t, 2.7 + i * 0.05, 2.98 + i * 0.05), run >= 1 && settle < 1 ? 0.9 : 0);
      const col = new THREE.Color(C.thread).lerp(new THREE.Color(C.magenta), de * (1 - settle) * 0.85).lerp(new THREE.Color(C.ink), settle * 0.7);
      c.up.mat.color.copy(col); c.down.mat.color.copy(col); c.cloud.mat.color.copy(col);
    });
    dataT.forEach((d, i) => { d.th.set(slabAnchor(i), vaultAnchor.clone().add(new THREE.Vector3((i - 1) * 2.2, 0, 0))); d.th.setProgress(ramp(t, 1.2 + i * 0.03, 1.32 + i * 0.03) * lerp(d.gap, 1, close)); });
    // In act 1 the network threads exist only as stubs that reach toward the
    // closet and stop short: connections that almost meet, before anything is
    // named. Act 2 draws them properly; the correction closes the gaps.
    const stub = 0.16 * ramp(t, 0.2, 0.6) * (1 - reveal);
    netT.forEach((n, i) => {
      n.th.set(deskScreenAnchor(i), swAnchor);
      n.th.setProgress(Math.max(stub * (0.6 + 0.4 * rnd(i + 111)), ramp(t, 1.24 + i * 0.02, 1.36 + i * 0.02) * lerp(n.gap, 1, close)));
      n.th.mat.opacity = lerp(0.22, 0.9, reveal);
      doorLight.intensity = 6 * (1 - 0.8 * glass);
      n.th.mat.color.setHex(C.thread).lerp(new THREE.Color(C.ink), settle * 0.5);
    });
    edgeT.th.set(swAnchor, outside); edgeT.th.setProgress(ramp(t, 1.3, 1.42) * lerp(edgeT.gap, 1, close));
    custT.forEach((c, i) => { c.th.set(outsideCloud.clone().add(new THREE.Vector3(i * 3, 0, 0)), slabAnchor(c.slab)); c.th.setProgress(ramp(t, 1.34 + i * 0.03, 1.46 + i * 0.03) * lerp(c.gap, 1, close)); });

    /* dependencies, boundaries, exceptions */
    deps.forEach((l) => { const pos = l.geometry.attributes.position; const a = l.userData.a(), b = l.userData.b(); pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true; l.computeLineDistances(); });
    depMat.opacity = 0.55 * depR * (1 - settle * 0.85); depMat.visible = depMat.opacity > 0.01;
    bounds.forEach((b, i) => setLoop(b, lerp(0.42 + 0.1 * i, 1, close) , 0.5 * ramp(t, 1.58 + i * 0.06, 1.72 + i * 0.06)));
    setLoop(perimeter, ramp(t, 2.74, 3.05), 0.75 * ramp(t, 2.74, 2.9));
    excs.forEach((m, i) => { m.position.copy(m.userData.at()); const s = ramp(t, 1.74 + i * 0.05, 1.86 + i * 0.05) * (1 - ramp(t, 2.66 + i * 0.05, 2.9 + i * 0.05)); m.scale.setScalar(Math.max(0.001, s)); m.material.uniforms.uIntensity.value = 1.2 + 0.35 * Math.sin(idleClock * 2.4 + i); });

    /* the access point: off-centre and quiet, then breathing once the world is level */
    const breathe = settle * (0.5 + 0.5 * Math.sin(idleClock * 1.4));
    apRing.scale.setScalar(1 + 0.35 * breathe); apRingMat.uniforms.uOpacity.value = lerp(0.35, 1, settle) * (1 - 0.5 * breathe);

    /* light: dawn → exposed → level and clean */
    const exposed = ramp(t, 1.0, 1.5);
    sun.color.setHex(C.warm).lerp(new THREE.Color(0x9fb0ff), exposed).lerp(new THREE.Color(0xffe6d2), settle);
    sun.intensity = lerp(3.8, 2.0, exposed) + settle * 1.2;
    ambient.intensity = 0.62 + 0.15 * exposed;
    hemi.intensity = lerp(1.4, 1.0, exposed);
    deLight.intensity = 9 * de * (1 - settle * 0.7); deLight.position.set(people[1].position.x - 1.2, 2.4, people[1].position.z + 0.6);
    renderer.toneMappingExposure = lerp(1.45, 1.25, exposed) + 0.2 * settle;

    /* camera and heading */
    cameraAt(t);
    camera.position.copy(camPos);
    upVec.set(Math.sin(tilt), Math.cos(tilt), 0); camera.up.copy(upVec);
    camera.lookAt(camLook);

    /* label anchors for the DOM */
    anchors.identity = people[0].userData.ring.position.clone().add(new THREE.Vector3(0, 0.25, 0));
    anchors.devices = deskScreenAnchor(0).add(new THREE.Vector3(0, 0.45, 0));
    anchors.email = slabAnchor(0).add(new THREE.Vector3(-0.9, 0.35, 0));
    anchors.data = vaultAnchor.clone().add(new THREE.Vector3(-2.6, 0, 1.3));
    anchors.network = swAnchor.clone().add(new THREE.Vector3(0, 0.55, 0));
    anchors.applications = slabAnchor(1).add(new THREE.Vector3(1.05, 0.35, -0.55));
    anchors.customers = outsideCloud.clone().add(new THREE.Vector3(1.5, -0.6, 0));
    anchors.vendor0 = slabAnchor(0).add(new THREE.Vector3(1.0, -0.2, 0.8));
    anchors.vendor1 = slabAnchor(2).add(new THREE.Vector3(1.0, -0.2, 0.8));
    anchors.vendor2 = new THREE.Vector3(5.6, 2.25, -3.9);
    excs.forEach((m, i) => { anchors['exc' + i] = m.position.clone().add(new THREE.Vector3(0, 0.22, 0)); });
    anchors.de = people[1].userData.ring.position.clone().add(new THREE.Vector3(0.2, 0.55, 0));

    return {
      disorder, reveal, depR, bndR, excR, de, settle,
      heading: Math.round(lerp(348, 360, 1 - disorder)),
    };
  }

  function project(vec, out) {
    v.copy(vec).project(camera);
    out.x = (v.x * 0.5 + 0.5) * canvas.clientWidth; out.y = (-v.y * 0.5 + 0.5) * canvas.clientHeight;
    out.behind = v.z > 1; return out;
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = portrait() ? 54 : 42; camera.updateProjectionMatrix();
  }
  function render() { renderer.render(scene, camera); }

  resize();
  return { update, render, resize, project, anchors, renderer, dispose: () => renderer.dispose() };
}
