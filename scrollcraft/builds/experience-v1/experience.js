/**
 * Experience v1 — the glue between the story and the world.
 *
 * Two presentations of the same markup:
 *
 *   flow   phones (≤ 767 px), reduced motion, no JavaScript. The three
 *          movements read as a page: copy, then a still rendered from the
 *          world. No pinning, nothing hidden, nothing animated.
 *   pin    wide screens with motion allowed. The engine (scrollcraft.js) pins
 *          ONE act; its progress p ∈ [0, 1] drives the movement windows (hard
 *          cuts at 0.30 and 0.62, so every scroll position shows exactly one
 *          movement at full strength) and ONE continuous timeline t for the
 *          world in scene.js: movement 1 → t 0..1, movement 2 → t 1..2,
 *          movement 3 → t 2.4..3.9. After the pin the world holds its last
 *          state behind "Where to begin".
 *
 * A movement that is not on screen is inert, so the keyboard never lands on a
 * control the reader cannot see; if focus does reach one, its movement is
 * brought on screen.
 *
 * Fallbacks in pin mode: before the WebGL library has loaded, without WebGL,
 * and on low-power devices, the stage shows stills rendered from the same
 * world (assets/stills), stepped by t. ?t=2.6 renders that timeline value
 * alone (used to render the stills).
 */
(function () {
  'use strict';
  var doc = document.documentElement;
  var params = new URLSearchParams(location.search);
  var stillT = params.has('t') ? parseFloat(params.get('t')) : null;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrowMQ = matchMedia('(max-width: 767px)');
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  // scene.js lives beside this script, wherever the page that loads it lives
  // (the lab page, or the site's /experience route)
  var SCENE_URL = document.currentScript && document.currentScript.src ? new URL('scene.js', document.currentScript.src).href : './scene.js';

  /* ---------------------------------------------------------- presentation */
  if (stillT === null && (reduce || narrowMQ.matches)) {
    doc.classList.add('x-flow');
    // the pinned presentation needs a fresh layout if the window later grows
    if (!reduce) narrowMQ.addEventListener('change', function (e) { if (!e.matches) location.reload(); });
    return;
  }
  doc.classList.add('x-pin');
  if (stillT === null) {
    ScrollCraft.mount(document.body);
    narrowMQ.addEventListener('change', function (e) { if (e.matches) location.reload(); });
  }

  var worldEl = document.getElementById('world');
  var canvas = document.getElementById('stage');
  var poster = document.getElementById('poster');
  var labelsEl = document.getElementById('labels');
  var pin = document.querySelector('[data-x-pin]');
  var webgl = (function () { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  var lowPower = (navigator.deviceMemory && navigator.deviceMemory < 3) || (navigator.connection && navigator.connection.saveData);
  var useStills = stillT === null && (!webgl || lowPower);

  /* -------------------------------------------------------------- movements */
  // [p from, p to, t from, t to]
  // movement 3 starts at t 2.4 so the correction (2.45–2.88) answers the
  // "one owner" heading within a third of a viewport of scroll
  var M = [[0, 0.30, 0, 1.0], [0.30, 0.62, 1.0, 2.0], [0.62, 1.0, 2.4, 3.9]];
  var groups = Array.prototype.slice.call(pin.querySelectorAll('[data-x-m]')).map(function (el) {
    return { el: el, from: parseFloat(el.getAttribute('data-x-from')), to: parseFloat(el.getAttribute('data-x-to')), on: null };
  });
  var geo = { top: 0, height: 0 };
  function layout() { var r = pin.getBoundingClientRect(); geo.top = r.top + scrollY; geo.height = r.height; }
  function travel() { return Math.max(geo.height - innerHeight, 1); }
  function progress() { return clamp01(((scrollY || pageYOffset) - geo.top) / travel()); }
  function timeline(p) {
    for (var i = 0; i < M.length; i++) {
      var m = M[i];
      if (p <= m[1] || i === M.length - 1) return m[2] + (m[3] - m[2]) * clamp01((p - m[0]) / (m[1] - m[0]));
    }
    return 0;
  }
  function setGroups(p) {
    groups.forEach(function (g) {
      var on = p >= g.from && (p < g.to || g.to >= 1);
      if (on === g.on) return;
      g.on = on;
      g.el.inert = !on;
      g.el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }
  // keyboard: focus inside a movement that is off screen brings that movement on screen
  document.addEventListener('focusin', function (e) {
    var g = e.target && e.target.closest ? e.target.closest('[data-x-m]') : null;
    if (!g) return;
    var p = progress(), from = parseFloat(g.getAttribute('data-x-from')), to = parseFloat(g.getAttribute('data-x-to'));
    if (p >= from && (p < to || to >= 1)) return;
    scrollTo({ top: Math.round(geo.top + (from + 0.01) * travel()), behavior: 'auto' });
  });

  /* ------------------------------------------------------------------ poster */
  var posterImgs = Array.prototype.slice.call(poster.querySelectorAll('img'));
  function posterFor(t) { return t < 1 ? 0 : t < 2.3 ? 1 : 2; }
  function showPoster(t) {
    var k = posterFor(t);
    posterImgs.forEach(function (img, i) { img.classList.toggle('on', i === k); });
  }

  /* ------------------------------------------------------------------ labels */
  // Only names that explain what DE maps and what it finds. No telemetry.
  var LABELS = [
    { key: 'identity', text: 'identity', from: 1.1, to: 2.42 },
    { key: 'devices', text: 'devices', from: 1.17, to: 2.42 },
    { key: 'email', text: 'email', from: 1.25, to: 2.42 },
    { key: 'data', text: 'data · backups', from: 1.3, to: 2.42 },
    { key: 'network', text: 'network', from: 1.36, to: 2.42 },
    { key: 'applications', text: 'applications', from: 1.41, to: 2.42 },
    { key: 'customers', text: 'customers', from: 1.47, to: 2.42 },
    { key: 'vendor0', text: 'vendor', from: 1.52, to: 2.42, cls: 'vendor' },
    { key: 'vendor1', text: 'vendor', from: 1.56, to: 2.42, cls: 'vendor' },
    { key: 'vendor2', text: 'vendor · carrier', from: 1.6, to: 2.42, cls: 'vendor' },
    { key: 'exc0', text: 'backup untested', from: 1.78, to: 2.62, cls: 'amber' },
    { key: 'exc1', text: 'unpatched', from: 1.83, to: 2.66, cls: 'amber' },
    { key: 'exc2', text: 'shared mailbox', from: 1.88, to: 2.7, cls: 'amber' },
    { key: 'exc3', text: 'guest network open', from: 1.93, to: 2.74, cls: 'amber' },
    { key: 'de', html: '<b>Digerati Experts</b> · one owner', from: 2.62, to: 3.9, cls: 'de' },
  ];
  var labelNodes = LABELS.map(function (l) {
    var el = document.createElement('div');
    el.className = 'x-label' + (l.cls ? ' ' + l.cls : '');
    if (l.html) el.innerHTML = l.html; else el.textContent = l.text;
    labelsEl.appendChild(el); return el;
  });
  var pt = { x: 0, y: 0, behind: false };
  function copyGuard() {
    // labels never sit under the copy column
    for (var i = 0; i < groups.length; i++) {
      if (!groups[i].on) continue;
      var c = groups[i].el.querySelector('.x-copy');
      if (c) return c.getBoundingClientRect().right + 24;
    }
    return 0;
  }
  function placeLabels(t, world) {
    var w = innerWidth, h = innerHeight, guard = copyGuard();
    LABELS.forEach(function (l, i) {
      var el = labelNodes[i];
      var on = t >= l.from && t <= l.to;
      var a = world.anchors[l.key];
      if (!on || !a) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
      world.project(a, pt);
      var half = el.offsetWidth / 2;
      var vis = !pt.behind && pt.x - half > guard && pt.x + half < w - 12 && pt.y > 70 && pt.y < h - 24;
      el.style.transform = 'translate(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px) translate(-50%,-100%)';
      var fade = Math.min(1, (t - l.from) / 0.06, (l.to - t) / 0.08);
      el.style.opacity = vis ? Math.max(0, fade).toFixed(2) : '0';
    });
  }

  /* -------------------------------------------------------------------- boot */
  layout();
  addEventListener('resize', function () { layout(); if (world) world.resize(); }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  addEventListener('load', layout);
  if (stillT === null) setGroups(progress());

  var world = null, lastTime = 0, running = false;
  // frame accounting for the prototype report: window.__xStats = { n, ms }
  var stats = { n: 0, ms: 0 }; window.__xStats = stats;

  function frame(now) {
    running = false;
    if (!pin.isConnected) return; // the site navigated away from the page
    var p = stillT !== null ? 0 : progress();
    var t = stillT !== null ? stillT : timeline(p);
    var dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016; lastTime = now;
    var onScreen = stillT !== null || scrollY < geo.top + geo.height;
    if (stillT === null) setGroups(p);
    if (!onScreen) return;
    var t0 = performance.now();
    world.update(t, dt);
    world.render();
    stats.n++; stats.ms += performance.now() - t0;
    placeLabels(t, world);
    if (stillT !== null) { doc.setAttribute('data-still-ready', '1'); return; }
    schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(frame); } }

  function startStills() {
    worldEl.classList.remove('live');
    var tick = function () { if (!pin.isConnected) return; var p = progress(); setGroups(p); showPoster(timeline(p)); };
    addEventListener('scroll', tick, { passive: true }); tick();
  }

  if (useStills) { startStills(); return; }

  // Stills carry the first paint; the world takes over once the library and
  // the scene have loaded and rendered their first frame.
  showPoster(timeline(progress()));
  // The single-file artifact build inlines scene.js as a module that announces
  // itself on window.__sceneModule; the served build imports it lazily.
  function loadScene() {
    if (window.__sceneModule) return Promise.resolve(window.__sceneModule);
    if (window.__xArtifact) return new Promise(function (resolve, reject) {
      document.addEventListener('x-scene', function () { resolve(window.__sceneModule); }, { once: true });
      setTimeout(function () { if (!window.__sceneModule) reject(new Error('scene module did not load')); }, 20000);
    });
    return import(SCENE_URL);
  }
  loadScene().then(function (mod) {
    var portrait = innerHeight > innerWidth;
    world = mod.createWorld(canvas, { maxDpr: portrait ? 1.25 : 1.5, shadows: !portrait });
    if (stillT !== null) doc.setAttribute('data-still', '1');
    world.resize();
    world.update(stillT !== null ? stillT : timeline(progress()), 0.016);
    world.render();
    worldEl.classList.add('live');
    addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) schedule(); });
    schedule();
  }).catch(function (err) {
    console.warn('[experience] world unavailable, stills only', err);
    startStills();
  });
})();
