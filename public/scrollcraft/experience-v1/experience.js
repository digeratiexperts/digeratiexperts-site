/**
 * Experience v1 — the glue between the page and the world. Revision 4.
 *
 * The change that matters: the world is driven by PAGE scroll, not by the
 * pinned act's own progress. Revision 3 tied the timeline to the pin, so the
 * world existed only while the story was pinned and the evidence sections
 * below it cut to a flat ground. Now one continuous timeline runs the whole
 * document, which gives three things at once:
 *
 *   - Every section flows. The world is behind all of them, still moving,
 *     dimming as the evidence takes over. Nothing cuts to flat.
 *   - Phones get the world. There is no pin to squeeze onto a phone, so the
 *     document-flow layout that fixed the blank-screen failure keeps working
 *     and still has the scene behind it.
 *   - The camera can keep arcing past the story, which is what makes the
 *     lateral movement read as one continuous move rather than a pinned trick.
 *
 * Two presentations of the same markup, as before:
 *
 *   flow   phones, reduced motion, no JavaScript. The three movements read as
 *          a document. On phones the world still renders behind them (it is
 *          cheap now); under reduced motion it does not, and the stills carry.
 *   pin    wide screens with motion allowed. The engine pins the story act so
 *          the three movements hold while the world transforms.
 *
 * Timeline mapping (page scroll fraction -> world t, 0..5):
 *   the story occupies t 0..3 across its own scroll span, and the evidence
 *   tail runs t 3..5 across everything below it. Both are continuous, so no
 *   scroll position anywhere on the page has a frozen world.
 */
(function () {
  'use strict';
  var doc = document.documentElement;
  var params = new URLSearchParams(location.search);
  var stillT = params.has('t') ? parseFloat(params.get('t')) : null;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrowMQ = matchMedia('(max-width: 767px)');
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var SCENE_URL = document.currentScript && document.currentScript.src
    ? new URL('scene.js', document.currentScript.src).href : './scene.js';

  /* ---------------------------------------------------------- presentation */
  var flow = stillT === null && (reduce || narrowMQ.matches);
  doc.classList.add(flow ? 'x-flow' : 'x-pin');
  if (stillT === null) {
    if (!flow) ScrollCraft.mount(document.body);
    narrowMQ.addEventListener('change', function () { location.reload(); });
  }

  var worldEl = document.getElementById('world');
  var canvas = document.getElementById('stage');
  var poster = document.getElementById('poster');
  var labelsEl = document.getElementById('labels');
  var pin = document.querySelector('[data-x-pin]');
  var webgl = (function () { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  var lowPower = (navigator.deviceMemory && navigator.deviceMemory < 3) || (navigator.connection && navigator.connection.saveData);
  // Reduced motion never animates the world. Phones now do, because the
  // abstract scene is cheap enough; low-power and no-WebGL still fall back.
  var useStills = stillT === null && (reduce || !webgl || lowPower);

  /* ---------------------------------------------------------------- timeline */
  // [page-scroll fraction from, to] -> [t from, to]. The story's fraction is
  // measured from the pin's real geometry so the mapping survives any layout.
  var geo = { top: 0, height: 0, docMax: 1 };
  function layout() {
    var r = pin.getBoundingClientRect();
    geo.top = r.top + scrollY;
    geo.height = r.height;
    geo.docMax = Math.max(doc.scrollHeight - innerHeight, 1);
  }
  function pageY() { return scrollY || pageYOffset; }
  function storyTravel() { return Math.max(geo.height - innerHeight, 1); }

  function timeline() {
    var y = pageY();
    var storyEnd = geo.top + storyTravel();
    if (y <= storyEnd) {
      // the story: 0 -> 3 across the pin's own travel
      return clamp01((y - geo.top) / storyTravel()) * 3;
    }
    // the tail: 3 -> 5 across everything below the story
    var rest = Math.max(geo.docMax - storyEnd, 1);
    return 3 + clamp01((y - storyEnd) / rest) * 2;
  }

  /* -------------------------------------------------------------- movements */
  var groups = Array.prototype.slice.call(pin.querySelectorAll('[data-x-m]')).map(function (el) {
    return { el: el, from: parseFloat(el.getAttribute('data-x-from')), to: parseFloat(el.getAttribute('data-x-to')), on: null };
  });
  function storyP() { return clamp01((pageY() - geo.top) / storyTravel()); }
  function setGroups(p) {
    groups.forEach(function (g) {
      var on = p >= g.from && (p < g.to || g.to >= 1);
      if (on === g.on) return;
      g.on = on;
      g.el.inert = !on;
      g.el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }
  // keyboard: focus inside an off-screen movement brings that movement on screen
  document.addEventListener('focusin', function (e) {
    var g = e.target && e.target.closest ? e.target.closest('[data-x-m]') : null;
    if (!g || doc.classList.contains('x-flow')) return;
    var p = storyP(), from = parseFloat(g.getAttribute('data-x-from')), to = parseFloat(g.getAttribute('data-x-to'));
    if (p >= from && (p < to || to >= 1)) return;
    scrollTo({ top: Math.round(geo.top + (from + 0.01) * storyTravel()), behavior: 'auto' });
  });

  /* ------------------------------------------------------------------ poster */
  var posterImgs = Array.prototype.slice.call(poster.querySelectorAll('img'));
  function showPoster(t) {
    var k = t < 1 ? 0 : t < 2.3 ? 1 : 2;
    posterImgs.forEach(function (img, i) { img.classList.toggle('on', i === k); });
  }

  /* ------------------------------------------------------------------ labels */
  var LABELS = [
    { key: 'identity', text: 'identity', from: 1.08, to: 2.30 },
    { key: 'devices', text: 'devices', from: 1.15, to: 2.30 },
    { key: 'email', text: 'email', from: 1.22, to: 2.30 },
    { key: 'data', text: 'data · backups', from: 1.28, to: 2.30 },
    { key: 'network', text: 'network', from: 1.34, to: 2.30 },
    { key: 'applications', text: 'applications', from: 1.40, to: 2.30 },
    { key: 'customers', text: 'customers', from: 1.46, to: 2.30 },
    { key: 'vendor0', text: 'vendor', from: 1.50, to: 2.30, cls: 'vendor' },
    { key: 'vendor1', text: 'vendor', from: 1.54, to: 2.30, cls: 'vendor' },
    { key: 'vendor2', text: 'vendor · carrier', from: 1.58, to: 2.30, cls: 'vendor' },
    { key: 'exc0', text: 'backup untested', from: 1.76, to: 2.36, cls: 'amber' },
    { key: 'exc1', text: 'unpatched', from: 1.81, to: 2.41, cls: 'amber' },
    { key: 'exc2', text: 'shared mailbox', from: 1.86, to: 2.46, cls: 'amber' },
    { key: 'exc3', text: 'guest network open', from: 1.91, to: 2.51, cls: 'amber' },
    { key: 'de', html: '<b>Digerati Experts</b> · one owner', from: 2.40, to: 3.30, cls: 'de' },
  ];
  var labelNodes = LABELS.map(function (l) {
    var el = document.createElement('div');
    el.className = 'x-label' + (l.cls ? ' ' + l.cls : '');
    if (l.html) el.innerHTML = l.html; else el.textContent = l.text;
    labelsEl.appendChild(el); return el;
  });
  var pt = { x: 0, y: 0, behind: false };
  function copyGuard() {
    if (doc.classList.contains('x-flow')) return 0;
    for (var i = 0; i < groups.length; i++) {
      if (!groups[i].on) continue;
      var c = groups[i].el.querySelector('.x-copy');
      if (c) return c.getBoundingClientRect().right + 24;
    }
    return 0;
  }
  var labelsHidden = false;
  function placeLabels(t, world) {
    // Flow mode has no copy column to keep clear: the plates span the width, so
    // a label can only land on top of the words. The story names identity,
    // devices, email, data, network, applications and customers in the copy
    // there anyway, so the labels are a wide-screen device only.
    if (doc.classList.contains('x-flow')) {
      if (!labelsHidden) { labelNodes.forEach(function (el) { el.style.opacity = '0'; }); labelsHidden = true; }
      return;
    }
    labelsHidden = false;
    var w = innerWidth, h = innerHeight, guard = copyGuard();
    LABELS.forEach(function (l, i) {
      var el = labelNodes[i];
      var on = t >= l.from && t <= l.to;
      var a = world.anchors[l.key];
      if (!on || !a) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
      world.project(a, pt);
      var half = el.offsetWidth / 2;
      // the label's box sits above its anchor (translate -100%), so the top
      // guard has to clear the header by the label's own height, not by zero
      var vis = !pt.behind && pt.x - half > guard && pt.x + half < w - 12
        && pt.y > 76 + el.offsetHeight && pt.y < h - 24;
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

  var world = null, lastTime = 0, running = false;
  var stats = { n: 0, ms: 0 }; window.__xStats = stats;
  // published for the motion gate: the timeline value of the frame last drawn
  window.__xT = 0;

  function frame(now) {
    running = false;
    if (!pin.isConnected) return;
    var t = stillT !== null ? stillT : timeline();
    var dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016; lastTime = now;
    if (stillT === null && !doc.classList.contains('x-flow')) setGroups(storyP());
    var t0 = performance.now();
    world.update(t, dt);
    world.render();
    window.__xT = t;
    stats.n++; stats.ms += performance.now() - t0;
    placeLabels(t, world);
    if (stillT !== null) { doc.setAttribute('data-still-ready', '1'); return; }
    schedule();
  }
  function schedule() { if (!running) { running = true; requestAnimationFrame(frame); } }

  function startStills() {
    worldEl.classList.remove('live');
    var tick = function () {
      if (!pin.isConnected) return;
      if (!doc.classList.contains('x-flow')) setGroups(storyP());
      showPoster(timeline());
    };
    addEventListener('scroll', tick, { passive: true }); tick();
  }

  if (stillT === null && !doc.classList.contains('x-flow')) setGroups(storyP());
  if (useStills) { startStills(); return; }

  showPoster(timeline());
  function loadScene() {
    if (window.__sceneModule) return Promise.resolve(window.__sceneModule);
    if (window.__xArtifact) return new Promise(function (resolve, reject) {
      document.addEventListener('x-scene', function () { resolve(window.__sceneModule); }, { once: true });
      setTimeout(function () { if (!window.__sceneModule) reject(new Error('scene module did not load')); }, 20000);
    });
    return import(SCENE_URL);
  }
  loadScene().then(function (mod) {
    var small = innerWidth < 768;
    world = mod.createWorld(canvas, { maxDpr: small ? 1.25 : 1.5 });
    if (stillT !== null) doc.setAttribute('data-still', '1');
    world.resize();
    world.update(stillT !== null ? stillT : timeline(), 0.016);
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
