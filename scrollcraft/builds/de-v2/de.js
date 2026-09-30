/* ============================================================================
   de.js · Digerati Experts Version B · the bespoke layer
   ----------------------------------------------------------------------------
   Everything here is page-specific. The scrollcraft engine is untouched; this
   script only READS the state the engine publishes (each act's --sc-p custom
   property) and drives the page's own signature system:

     THE TECHNOLOGY MAP · one model, three renders
       #big-map     the peak figure. Scattered fragments migrate home while a
                    technical drawing of the environment draws itself, staged
                    off chapter three's scroll progress.
       #answer-map  chapter four's interactive render. Choosing a business
                    outcome lights the domains that deliver it.
       #mini-map    the margin instrument's miniature, the reader's running
                    record: scattered in chapter two, assembling through the
                    peak, complete and quietly energized for the rest of the
                    read.

   Under prefers-reduced-motion every state still happens; it snaps between
   stages instead of scrubbing through them.
   ========================================================================== */
(function (global) {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp01 = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var ramp = function (p, a, b) { return clamp01((p - a) / (b - a)); };

  /* ---------------------------------------------------------- the model -- */
  var NODE_W = 152, NODE_H = 36;
  var NODES = [
    { id: 'identity',       label: 'IDENTITY',        x: 190, y: 335 },
    { id: 'workplace',      label: 'DIGITAL WORKPLACE', x: 372, y: 205 },
    { id: 'business',       label: 'BUSINESS SYSTEMS',  x: 585, y: 205 },
    { id: 'communications', label: 'COMMUNICATIONS',    x: 798, y: 205 },
    { id: 'data',           label: 'DATA',            x: 372, y: 335 },
    { id: 'automation',     label: 'AUTOMATION',      x: 585, y: 335 },
    { id: 'ai',             label: 'AI',              x: 798, y: 335 },
    { id: 'it',             label: 'MANAGED IT',      x: 372, y: 465 },
    { id: 'infrastructure', label: 'INFRASTRUCTURE',  x: 585, y: 465 },
    { id: 'cloud',          label: 'CLOUD',           x: 798, y: 465 },
    { id: 'risk',           label: 'RISK',            x: 985, y: 240 },
    { id: 'compliance',     label: 'COMPLIANCE',      x: 985, y: 420 },
    { id: 'marketplace',    label: 'MARKETPLACE',     x: 300, y: 612 }
  ];
  /* structural links drawn in stage d2 */
  var LINKS = [
    'M190,205 L296,205', 'M190,335 L296,335', 'M190,465 L296,465',
    'M372,353 L372,447', 'M585,353 L585,447', 'M798,353 L798,447'
  ];
  /* flows drawn in stage d3, each owned by a domain for outcome lighting */
  var FLOWS = [
    { d: 'M372,223 L372,317', dom: 'data' },
    { d: 'M585,223 L585,317', dom: 'automation' },
    { d: 'M798,223 L798,317', dom: 'ai' },
    { d: 'M448,335 L509,335', dom: 'automation' },
    { d: 'M661,335 L722,335', dom: 'ai' },
    { d: 'M585,106 L585,187', dom: 'people' }
  ];
  var LEADS = [
    { d: 'M890,300 L909,252', dom: 'risk' },
    { d: 'M890,380 L909,408', dom: 'compliance' },
    { d: 'M300,594 L300,553', dom: 'marketplace' }
  ];

  var OUTCOMES = {
    protect: {
      lead: 'Ransomware and phishing meet closed ranks: identity, devices, network, and recovery, with risk and compliance reading the whole time.',
      domains: ['security', 'identity', 'it', 'infrastructure', 'cloud', 'risk', 'compliance']
    },
    productive: {
      lead: 'The workplace, the business systems, and the people signing into them start behaving like one office.',
      domains: ['workplace', 'identity', 'business', 'communications', 'it', 'automation']
    },
    automate: {
      lead: 'The work between systems moves on its own, and the approvals stay human.',
      domains: ['automation', 'ai', 'business', 'data', 'identity', 'security', 'people']
    },
    comply: {
      lead: 'HIPAA, IRS, FTC, ABA: controls, evidence, and monitoring line up so the audit is a reading, not an excavation.',
      domains: ['risk', 'compliance', 'identity', 'security', 'data', 'infrastructure']
    }
  };
  var DOMAIN_NAMES = {
    security: 'Security', identity: 'Identity', it: 'Managed IT',
    infrastructure: 'Infrastructure', cloud: 'Cloud', workplace: 'Digital Workplace',
    business: 'Business Systems', communications: 'Communications', data: 'Data',
    automation: 'Automation', ai: 'AI', risk: 'Risk', compliance: 'Compliance',
    marketplace: 'Marketplace', people: 'Human Approvals'
  };

  /* --------------------------------------------------------- rendering --- */
  function svgEl(name, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  /* deterministic scatter offset per node index, for the big map */
  function scatter(i) {
    return {
      x: ((i * 137 + 61) % 320) - 160,
      y: ((i * 89 + 23) % 220) - 110
    };
  }

  function renderMap(host, opts) {
    if (!host) return null;
    var svg = svgEl('svg', { viewBox: '0 0 1080 660', class: 'demap', 'aria-hidden': 'true', focusable: 'false' });
    if (opts.draw) svg.setAttribute('data-draw', '');

    var stroke = function (el) { el.setAttribute('vector-effect', 'non-scaling-stroke'); el.setAttribute('pathLength', '1'); return el; };

    /* security perimeter: the frame IS the security domain */
    svg.appendChild(stroke(svgEl('rect', { class: 'm-frame', 'data-domain': 'security', x: 70, y: 120, width: 820, height: 430, rx: 10 })));
    var frameLabel = svgEl('text', { class: 'm-frame-label', 'data-domain': 'security', x: 88, y: 574, 'font-size': 13 });
    frameLabel.textContent = 'SECURITY · A PROPERTY OF THE FRAME, NOT A BOX INSIDE IT';
    svg.appendChild(frameLabel);

    /* monitoring ticks along the frame top */
    for (var t = 0; t < 6; t++) {
      svg.appendChild(stroke(svgEl('path', { class: 'm-tick', d: 'M' + (430 + t * 80) + ',112 L' + (430 + t * 80) + ',128' })));
    }

    /* identity spine */
    svg.appendChild(stroke(svgEl('path', { class: 'm-spine', 'data-domain': 'identity', d: 'M190,150 L190,520' })));

    /* structural links, then flows, then leads */
    LINKS.forEach(function (d) { svg.appendChild(stroke(svgEl('path', { class: 'm-link', d: d }))); });
    FLOWS.forEach(function (f) { svg.appendChild(stroke(svgEl('path', { class: 'm-flow', 'data-domain': f.dom, d: f.d }))); });
    LEADS.forEach(function (l) { svg.appendChild(stroke(svgEl('path', { class: 'm-lead', 'data-domain': l.dom, d: l.d }))); });

    /* the human approvals gate above the frame */
    var gate = svgEl('g', { class: 'm-gate', 'data-domain': 'people' });
    gate.appendChild(svgEl('polygon', { points: '585,72 605,90 585,108 565,90' }));
    var gateText = svgEl('text', { x: 620, y: 95, 'font-size': 13 });
    gateText.textContent = 'PEOPLE · APPROVALS';
    gate.appendChild(gateText);
    svg.appendChild(gate);

    /* domain nodes */
    NODES.forEach(function (n, i) {
      var g = svgEl('g', { class: 'm-node', 'data-domain': n.id });
      g.style.setProperty('--ni', String(i));
      if (opts.draw) {
        var s = scatter(i);
        g.style.setProperty('--nx', String(s.x));
        g.style.setProperty('--ny', String(s.y));
      }
      g.appendChild(svgEl('rect', { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2, width: NODE_W, height: NODE_H, rx: 4 }));
      var txt = svgEl('text', { x: n.x, y: n.y + 4.5, 'text-anchor': 'middle', 'font-size': 13.5 });
      txt.textContent = n.label;
      g.appendChild(txt);
      svg.appendChild(g);
    });

    host.appendChild(svg);
    return svg;
  }

  /* ------------------------------------------------------- draw driving -- */
  var STAGES = [[0.04, 0.24], [0.16, 0.42], [0.36, 0.6], [0.54, 0.78], [0.7, 0.9]];

  function writeStages(svg, p) {
    for (var i = 0; i < 5; i++) {
      var v = ramp(p, STAGES[i][0], STAGES[i][1]);
      if (reduce) v = v > 0.5 ? 1 : 0;
      svg.style.setProperty('--d' + i, v.toFixed(3));
    }
    svg.classList.toggle('demap--linked', p > 0.62);
    svg.classList.toggle('demap--energized', p > 0.88);
  }
  function setStagesFlat(svg, vals) {
    for (var i = 0; i < 5; i++) svg.style.setProperty('--d' + i, String(vals[i]));
  }

  /* ---------------------------------------------------------- lighting --- */
  function light(svg, domains) {
    if (!svg) return;
    if (!domains) { svg.removeAttribute('data-lit'); return; }
    svg.setAttribute('data-lit', '');
    var all = svg.querySelectorAll('[data-domain]');
    for (var i = 0; i < all.length; i++) {
      var on = domains.indexOf(all[i].getAttribute('data-domain')) > -1;
      all[i].classList.toggle('is-lit', on);
    }
  }

  /* ================================================================ init == */
  function init() {
    var bigHost = document.getElementById('big-map');
    var answerHost = document.getElementById('answer-map');
    var miniHost = document.getElementById('mini-map');

    var big = renderMap(bigHost, { draw: true });
    var answer = renderMap(answerHost, { draw: false });
    var mini = renderMap(miniHost, { draw: true });

    var ch2 = document.getElementById('ch-2');
    var ch3 = document.getElementById('ch-3');
    var chapters = document.querySelectorAll('[data-chapter]');
    var folioNo = document.getElementById('folio-no');
    var folioTitle = document.getElementById('folio-title');
    var readout = document.getElementById('readout');
    var currentChapter = 1;
    var passedPeak = false;

    /* --- the wake-up: stage the drawing off chapter three's --sc-p -------- */
    var lastP = -1;
    function frame() {
      var p = parseFloat(ch3 && ch3.style.getPropertyValue('--sc-p')) || 0;
      if (Math.abs(p - lastP) > 0.0015) {
        lastP = p;
        if (big) writeStages(big, p);
        if (p > 0.9) passedPeak = true;
        /* the mini instrument follows: scattered before, assembling with the
           peak, complete after */
        if (mini) {
          if (currentChapter <= 1 && !passedPeak) setStagesFlat(mini, [0, 0, 0, 0, 0]);
          else if (currentChapter === 2 && !passedPeak) setStagesFlat(mini, [0, 0.3, 0, 0, 0]);
          else writeStages(mini, passedPeak ? Math.max(p, 1) : p);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    /* --- folio + chapter tracking ---------------------------------------- */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var n = parseInt(e.target.getAttribute('data-chapter'), 10);
          currentChapter = n;
          var inst = document.getElementById('instrument');
          if (inst) {
            inst.classList.remove('instrument--tick');
            void inst.offsetWidth;
            inst.classList.add('instrument--tick');
          }
          folioNo.textContent = 'CH ' + String(n).padStart(2, '0');
          folioTitle.textContent = e.target.getAttribute('data-chapter-title');
          lastP = -1; /* force an instrument refresh */
          /* the instrument mirrors chapter four's lighting, then settles */
          if (mini) {
            if (n === 4) light(mini, activeDomains());
            else light(mini, null);
          }
        });
      }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
      chapters.forEach(function (c) { io.observe(c); });
    }

    /* --- outcomes: the map answers ---------------------------------------- */
    var buttons = document.querySelectorAll('.outcome');
    var active = 'protect';
    function activeDomains() { return OUTCOMES[active].domains; }
    function applyOutcome(key) {
      active = key;
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-outcome') === key ? 'true' : 'false');
      });
      var o = OUTCOMES[key];
      light(answer, o.domains);
      if (currentChapter === 4) light(mini, o.domains);
      if (readout) {
        var names = o.domains.map(function (d) { return DOMAIN_NAMES[d]; }).join(' · ');
        readout.innerHTML = o.lead + ' <b>' + names + '</b>.';
      }
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { applyOutcome(b.getAttribute('data-outcome')); });
    });
    if (buttons.length) applyOutcome('protect');
  }

  global.DEV2 = { init: init };
})(window);
