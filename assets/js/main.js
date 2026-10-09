/* ==========================================================================
   KNEO Automation — site behaviour
   main.js  ·  vanilla, dependency-free, defer-loaded
   --------------------------------------------------------------------------
   1.  Utilities
   2.  Theme switcher
   3.  Header state + scroll progress
   4.  Mobile drawer + dropdown a11y
   5.  Reveal-on-scroll (+ staggering)
   6.  Split-text headline reveal
   7.  Animated counters
   8.  Accordions
   9.  Tabs
   10. In-page sub-nav scrollspy
   11. Parallax
   12. Hero background (video probe, canvas, cursor motion)
   13. Forms
   14. Scroll start position + misc (year stamp, external links, back-to-top)
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. UTILITIES
     ==================================================================== */

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var prefersReduced = function () { return reduceMotion.matches; };

  function on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts || false); }

  /* Frame-synced throttle — for work that must line up with painting
     (parallax transforms). Deliberately not used for state changes, because
     requestAnimationFrame is suspended while a document is hidden. */
  function rafThrottle(fn) {
    var ticking = false;
    return function () {
      var args = arguments, self = this;
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        fn.apply(self, args);
        ticking = false;
      });
    };
  }

  /* Time-based throttle with a trailing call — used for scroll-driven state
     (header, progress bar, reveal sweep, scrollspy) so those keep working
     regardless of frame scheduling. */
  function throttle(fn, wait) {
    var last = 0, timer = null;
    return function () {
      var args = arguments, self = this, now = Date.now(), remaining = wait - (now - last);
      if (remaining <= 0) {
        if (timer) { window.clearTimeout(timer); timer = null; }
        last = now;
        fn.apply(self, args);
      } else if (!timer) {
        timer = window.setTimeout(function () {
          last = Date.now();
          timer = null;
          fn.apply(self, args);
        }, remaining);
      }
    };
  }

  /* ========================================================================
     2. THEME SWITCHER
     ==================================================================== */

  /* ------------------------------------------------------------------------
     Theme.

     Three states, but only two buttons' worth of UI. A reader who has never
     touched the toggle follows their browser's colour scheme and keeps
     following it, so a machine that flips to dark at sunset takes the site
     with it. The moment they pick a side, that choice is stored and outranks
     the system.

     Toggling back to whatever the system already prefers CLEARS the stored
     choice instead of writing it. That is the only route back to "just follow
     my system" without inventing a third control, and it costs nothing: at
     that instant the override and the system agree anyway.
     ---------------------------------------------------------------------- */
  function initTheme() {
    var root = document.documentElement;
    var STORE = 'kneo-theme';
    var mq = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: light)')
      : null;

    function stored() {
      try {
        var v = window.localStorage.getItem(STORE);
        return (v === 'light' || v === 'dark') ? v : null;
      } catch (e) { return null; }
    }

    function systemTheme() { return (mq && mq.matches) ? 'light' : 'dark'; }

    /* The browser chrome should match what is actually on screen, not what the
       OS prefers - the two diverge the moment a reader overrides. The static
       media-scoped pair in the head would fight that, so their media is
       dropped once scripting is in charge. Colour is read back off --bg so it
       cannot drift from the stylesheet. */
    function paintChrome(theme) {
      var bg = getComputedStyle(root).getPropertyValue('--bg').trim() ||
               (theme === 'light' ? '#FFFFFF' : '#171A2E');
      $$('meta[name="theme-color"]').forEach(function (m) {
        m.removeAttribute('media');
        m.setAttribute('content', bg);
      });
    }

    function apply(theme) {
      root.setAttribute('data-theme', theme);
      $$('[data-theme-toggle]').forEach(function (btn) {
        btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
        btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      });
      paintChrome(theme);
      window.dispatchEvent(new CustomEvent('kneo:theme', { detail: { theme: theme } }));
    }

    /* Suppress transition thrash on very large pages during the swap. */
    function swap(theme) {
      root.classList.add('theme-switching');
      apply(theme);
      window.setTimeout(function () { root.classList.remove('theme-switching'); }, 500);
    }

    apply(stored() || systemTheme());

    $$('[data-theme-toggle]').forEach(function (btn) {
      on(btn, 'click', function () {
        var next = (root.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
        try {
          if (next === systemTheme()) window.localStorage.removeItem(STORE);
          else window.localStorage.setItem(STORE, next);
        } catch (e) {}
        swap(next);
      });
    });

    /* Track the system live, but only while no stored choice is overriding it.
       addListener is the pre-2020 Safari spelling and still worth keeping. */
    if (mq) {
      var onSystem = function () { if (!stored()) swap(systemTheme()); };
      if (mq.addEventListener) mq.addEventListener('change', onSystem);
      else if (mq.addListener) mq.addListener(onSystem);
    }

    /* Belt and braces. The listener above covers a system that flips while the
       page is open, but change events do not fire in every embedded webview,
       and a reader who switches their OS theme in another window comes back to
       a stale page either way. Re-checking on return costs nothing. */
    function resync() {
      if (!stored() && root.getAttribute('data-theme') !== systemTheme()) {
        swap(systemTheme());
      }
    }
    on(document, 'visibilitychange', function () { if (!document.hidden) resync(); });
    on(window, 'pageshow', resync);
  }

  /* ========================================================================
     3. HEADER STATE + SCROLL PROGRESS
     ==================================================================== */

  function initHeader() {
    var header = $('.site-header');
    var bar = $('.scroll-progress');
    if (!header && !bar) return;

    var update = throttle(function () {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (header) header.classList.toggle('is-stuck', y > 24);
      if (bar) {
        var doc = document.documentElement;
        var max = (doc.scrollHeight - window.innerHeight) || 1;
        bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, y / max)) + ')';
      }
    }, 80);

    on(window, 'scroll', update, { passive: true });
    on(window, 'resize', update, { passive: true });
    update();
  }

  /* ========================================================================
     4. MOBILE DRAWER + DROPDOWN ACCESSIBILITY
     ==================================================================== */

  function initNav() {
    var body = document.body;
    var toggle = $('[data-nav-toggle]');
    var drawer = $('.drawer');
    var scrim = $('.drawer__scrim');
    var panel = $('.drawer__panel');

    function closeDrawer() {
      if (!body.classList.contains('nav-open')) return;
      body.classList.remove('nav-open');
      if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
      if (drawer) drawer.setAttribute('aria-hidden', 'true');
    }
    function openDrawer() {
      body.classList.add('nav-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
      if (drawer) drawer.setAttribute('aria-hidden', 'false');
      var first = panel && panel.querySelector('a, button');
      if (first) window.setTimeout(function () { first.focus(); }, 320);
    }

    on(toggle, 'click', function () {
      body.classList.contains('nav-open') ? closeDrawer() : openDrawer();
    });
    on(scrim, 'click', closeDrawer);
    $$('.drawer__panel a').forEach(function (a) { on(a, 'click', closeDrawer); });

    on(document, 'keydown', function (e) {
      if (e.key === 'Escape') {
        closeDrawer();
        $$('.nav__item.is-open').forEach(function (i) { i.classList.remove('is-open'); });
      }
    });

    // Close drawer if resized up to desktop
    var mq = window.matchMedia('(min-width: 1081px)');
    var mqHandler = function (e) { if (e.matches) closeDrawer(); };
    if (mq.addEventListener) mq.addEventListener('change', mqHandler);
    else if (mq.addListener) mq.addListener(mqHandler);

    // Drawer collapsible groups
    $$('.drawer__group').forEach(function (group) {
      var summary = $('.drawer__summary', group);
      var sub = $('.drawer__sub', group);
      if (!summary || !sub) return;
      summary.setAttribute('aria-expanded', 'false');
      on(summary, 'click', function () {
        var open = group.classList.toggle('is-open');
        summary.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

    // Desktop dropdowns: keyboard support (hover is CSS-driven)
    $$('.nav__item').forEach(function (item) {
      var trigger = $('.nav__link', item);
      var mega = $('.mega', item);
      if (!trigger || !mega) return;
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');

      function setOpen(state) {
        item.classList.toggle('is-open', state);
        trigger.setAttribute('aria-expanded', state ? 'true' : 'false');
      }
      on(trigger, 'click', function (e) {
        // Allow real navigation on links that point somewhere concrete
        if (trigger.getAttribute('href') && trigger.getAttribute('href') !== '#') return;
        e.preventDefault();
        setOpen(!item.classList.contains('is-open'));
      });
      on(item, 'focusin', function () { setOpen(true); });
      on(item, 'focusout', function (e) {
        if (!item.contains(e.relatedTarget)) setOpen(false);
      });
      on(item, 'mouseleave', function () { setOpen(false); });
    });
  }

  /* ========================================================================
     5. REVEAL ON SCROLL
     ==================================================================== */

  /* ------------------------------------------------------------------------
     Cursor sheen.

     The overlay node is created on first hover, not at boot. A page can carry
     forty cards; building forty overlays up front costs DOM on every visit to
     buy an effect most of them never show - and none of them show on a touch
     screen. createPointerTracker already declines on coarse pointers and under
     reduced motion, so this is a no-op there as well.
     ---------------------------------------------------------------------- */
  function initSheen() {
    if (prefersReduced()) return;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!fine.matches) return;

    $$('.card, .cell, .index-row, .article-card').forEach(function (el) {
      if (el.classList.contains('has-sheen')) return;
      el.classList.add('has-sheen');

      var span = null;
      on(el, 'pointerenter', function () {
        if (span) return;
        span = document.createElement('span');
        span.className = 'sheen';
        span.setAttribute('aria-hidden', 'true');
        el.insertBefore(span, el.firstChild);

        createPointerTracker(el, function (x, y, r) {
          if (!r.width || !r.height) return;
          span.style.setProperty('--sx', ((x / r.width) * 100).toFixed(1) + '%');
          span.style.setProperty('--sy', ((y / r.height) * 100).toFixed(1) + '%');
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Reading cadence.

     Article bodies were one fade for the whole document: fifteen hundred words
     arriving as a single block, which is why the blog read as the most static
     part of the site. Each paragraph now arrives as it enters view.

     Deliberately no incremental delay. A compounding stagger would leave the
     reader waiting on paragraph forty; scrolling already supplies the rhythm,
     and the transition only softens the arrival.

     Runs before initReveal so the attributes it writes are picked up by that
     observer instead of needing a second one.
     ---------------------------------------------------------------------- */
  function initProseCadence() {
    $$('.prose').forEach(function (prose) {
      var kids = [], n = prose.children.length;
      for (var i = 0; i < n; i++) {
        var t = prose.children[i].tagName;
        if (t === 'P' || t === 'H2' || t === 'H3' || t === 'UL' ||
            t === 'OL' || t === 'BLOCKQUOTE' || t === 'FIGURE') {
          kids.push(prose.children[i]);
        }
      }
      /* Short bodies read better arriving whole - leave those alone. */
      if (kids.length < 4) return;

      prose.removeAttribute('data-reveal');
      prose.style.removeProperty('--reveal-delay');
      kids.forEach(function (el) {
        if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', 'text');
      });
    });
  }

  /* Screenshots wipe up into place. Fading an image looks like a slow load;
     a wipe looks like a decision. */
  function initMediaReveal() {
    $$('.page-shot, .article-card__img').forEach(function (el) {
      if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
    });
  }

  /* ------------------------------------------------------------------------
     Global presence map.

     Regions and their member countries are exactly the ones on the map the
     company supplied - nothing has been added to make the spread look wider.

     Each entry carries an `area` outline as well as a pin. Selecting a region
     lights every land cell inside that outline, rippling outward from the pin,
     rather than highlighting a single dot: at this scale one dot reads as a
     speck, while a whole territory lighting up reads as presence.

     The outlines are deliberately coarse. The map samples at two degrees, so
     a cell is 200-plus kilometres wide and there is no honest way to draw a
     border more precisely than that. They are intersected with the verified
     land mask, so only real land can ever light up.
     ---------------------------------------------------------------------- */
  var PRESENCE = [
    { name: 'US & Canada', lon: -98, lat: 42, detail: 'United States · Canada',
      area: [-170,73, -125,74, -95,75, -80,75, -70,73, -68,68, -78,65, -80,60,
             -66,58, -55,52, -60,46, -70,43, -80,40, -84,30, -98,26, -108,31,
             -117,32, -125,42, -132,54, -145,60, -170,66] },
    { name: 'Latin America', lon: -50, lat: -12, detail: 'Brazil',
      area: [-74,6, -50,7, -34,-4, -34,-24, -48,-27, -58,-34, -66,-18, -74,-8] },
    { name: 'United Kingdom', lon: -2, lat: 54, detail: '',
      area: [-11,50, 2,50, 2,59, -6,61, -11,56] },
    { name: 'Europe', lon: 12, lat: 49,
      detail: 'Germany · France · Italy · Poland · Czechia · Slovakia · Austria · Netherlands · Romania · Greece',
      area: [-5,42, -2,49, 3,52, 7,54, 14,55, 24,55, 29,47, 27,44, 26,35,
             19,35, 12,36, 6,43] },
    { name: 'Israel', lon: 35, lat: 31.4, detail: '',
      area: [33.8,29, 36.2,29, 36.2,34, 33.8,34] },
    { name: 'Iran', lon: 53.7, lat: 32.4, detail: '',
      area: [44,25, 63,25, 63,38, 56,40, 48,40, 44,37] },
    { name: 'India', lon: 79, lat: 22, detail: '',
      area: [68,7, 80,7, 90,15, 93,22, 97,28, 88,31, 78,36, 72,32, 68,23] },
    { name: 'China', lon: 104, lat: 35, detail: '',
      area: [73,36, 90,28, 98,22, 108,20, 114,22, 122,30, 124,40, 131,45,
             126,53, 115,50, 100,45, 87,49, 75,40] },
    { name: 'South Korea', lon: 127.8, lat: 36.5, detail: '',
      area: [125.8,34, 130,34, 130,39, 125.8,39] },
    { name: 'Thailand', lon: 101, lat: 15.2, detail: '',
      area: [97,6, 106,6, 106,15, 103,19, 100,21, 97,18] },
    { name: 'Indonesia', lon: 113, lat: -2, detail: '',
      area: [95,6, 120,6, 141,1, 141,-11, 95,-11] }
  ];

  /* The mask spans 180 lon-cells over 360 degrees and 71 lat-cells from 84N
     to 58S, so a coordinate maps to a percentage of the box directly. */
  function presenceX(lon) { return (lon + 180) / 360 * 100; }
  function presenceY(lat) { return (84 - lat) / 142 * 100; }

  function presenceInPoly(x, y, p) {
    var inside = false, n = p.length / 2;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = p[i * 2], yi = p[i * 2 + 1], xj = p[j * 2], yj = p[j * 2 + 1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function initWorldMap() {
    /* Scope every lookup to the figure, not to .worldmap: the readout sits
       outside the scrolling map so it stays put on a phone. */
    var wrap = $('.worldmap-wrap');
    if (!wrap) return;
    var canvas  = $('.worldmap__dots', wrap);
    var pinbox  = $('.worldmap__pins', wrap);
    var readout = $('.worldmap__readout', wrap);
    var place   = $('.worldmap__place', wrap);
    var detail  = $('.worldmap__detail', wrap);
    if (!canvas || !pinbox || !place || !detail || !readout) return;

    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;

    var mask = plDecodeMask();
    if (!mask.length) return;

    /* ---- which land cells belong to which region --------------------------
       Computed once against the mask, not per frame. Each member cell also
       stores its distance from the pin, normalised, which becomes its delay
       so the fill ripples outward instead of switching on all at once. */
    var COLS = PL_MAP_COLS, ROWS = PL_MAP_ROWS;
    var RISE = 260, SPREAD = 380, FADE = 220;
    var areas = PRESENCE.map(function (item) {
      var cells = new Float32Array(COLS * ROWS);   /* 0 = not a member */
      var px = (item.lon + 180) / 2, py = (84 - item.lat) / 2;
      var maxD = 0, list = [];
      for (var gy = 0; gy < ROWS; gy++) {
        for (var gx = 0; gx < COLS; gx++) {
          if (!mask[gy * COLS + gx]) continue;
          var lon = -180 + (gx + 0.5) * 2, lat = 84 - (gy + 0.5) * 2;
          if (!presenceInPoly(lon, lat, item.area)) continue;
          var d = Math.sqrt((gx - px) * (gx - px) + (gy - py) * (gy - py));
          if (d > maxD) maxD = d;
          list.push({ i: gy * COLS + gx, d: d });
        }
      }
      list.forEach(function (c) { cells[c.i] = maxD > 0 ? (c.d / maxD) : 0; cells[c.i] += 0.0001; });

      /* The ripple delay is normalised 0..1, so without this a two-cell
         country would take exactly as long to fill as North America. Spread
         is scaled by the region's real extent instead. */
      var spread = SPREAD * Math.max(0.2, Math.min(1, maxD / 26));

      /* Israel and South Korea are two cells at this resolution - roughly
         300 times smaller than US & Canada - and at the shared dot size they
         simply did not register. Small regions draw a heavier dot so they can
         be seen. This changes how the marker is drawn, never which cells are
         lit, so it does not overstate where the company works. */
      var boost = Math.min(2.2, Math.max(1, Math.sqrt(32 / Math.max(list.length, 1))));

      return { cells: cells, count: list.length, maxD: maxD,
               spread: spread, boost: boost, draw: [] };
    });

    /* ---- geometry + the muted base layer ---------------------------------
       The unhighlighted dots never change, so they are drawn once into an
       offscreen canvas and blitted each frame. Only the lit region is redrawn,
       which keeps the animation cheap even at 180 columns. */
    var W = 0, H = 0, across = 0, down = 0, sx = 0, sy = 0, rad = 0, dpr = 1;
    var base = document.createElement('canvas');
    var bctx = base.getContext('2d');
    var accentRGB = [255, 90, 46];

    function readAccent() {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      var m = v.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      if (m) accentRGB = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    }

    function build() {
      var r = canvas.getBoundingClientRect();
      W = Math.max(r.width, 1); H = Math.max(r.height, 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base.width = canvas.width; base.height = canvas.height;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      across = Math.max(60, Math.min(COLS, Math.floor(W / 5)));
      down   = Math.max(22, Math.round(across * ROWS / COLS));
      sx = W / across; sy = H / down;
      rad = Math.max(0.9, Math.min(sx, sy) * 0.28);

      readAccent();
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      bctx.clearRect(0, 0, W, H);
      bctx.fillStyle = light ? 'rgba(15,23,42,0.30)' : 'rgba(190,205,240,0.26)';
      for (var y = 0; y < down; y++) {
        var gy = Math.min(ROWS - 1, Math.floor(y * ROWS / down));
        for (var x = 0; x < across; x++) {
          var gx = Math.min(COLS - 1, Math.floor(x * COLS / across));
          if (!mask[gy * COLS + gx]) continue;
          bctx.beginPath();
          bctx.arc((x + 0.5) * sx, (y + 0.5) * sy, rad, 0, Math.PI * 2);
          bctx.fill();
        }
      }
      /* Per-region draw lists. paintArea used to walk all 12,780 grid
         cells every frame to find the 2-580 that were lit, and twice over
         during a cross-fade. Building the list once per resize turns that
         into a walk of just the member cells. */
      for (var ai = 0; ai < areas.length; ai++) {
        var a = areas[ai], dl = [];
        for (var dy = 0; dy < down; dy++) {
          var mgy = Math.min(ROWS - 1, Math.floor(dy * ROWS / down));
          for (var dx = 0; dx < across; dx++) {
            var mgx = Math.min(COLS - 1, Math.floor(dx * COLS / across));
            var v = a.cells[mgy * COLS + mgx];
            if (!v) continue;
            dl.push({ x: (dx + 0.5) * sx, y: (dy + 0.5) * sy, delay: v - 0.0001 });
          }
        }
        a.draw = dl;
      }

      paintStatic();
    }

    /* ---- the fill animation ---------------------------------------------- */
    var cur = null, prev = null, raf = null;

    function paintArea(entry, alphaMul, now) {
      var a = areas[entry.idx];
      if (!a || !a.draw.length) return;
      var t = now - entry.start;
      var spread = a.spread, r0 = rad * a.boost;
      var col = accentRGB[0] + ',' + accentRGB[1] + ',' + accentRGB[2] + ',';
      for (var i = 0; i < a.draw.length; i++) {
        var c = a.draw[i];
        var p = (t - c.delay * spread) / RISE;
        if (p <= 0) continue;
        if (p > 1) p = 1;
        var e = 1 - Math.pow(1 - p, 3);            /* ease out */
        var al = e * alphaMul;
        if (al <= 0.01) continue;
        ctx.fillStyle = 'rgba(' + col + al.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(c.x, c.y, r0 * (1 + 0.5 * e), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* The base layer is blitted synchronously, never only from inside a rAF
       callback. requestAnimationFrame does not run in a background tab, under
       some low-power modes, or in certain embedded webviews, and a world map
       that renders blank in those cases is far worse than one that renders
       without its animation. */
    function paintStatic() {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(base, 0, 0, W, H);
      if (cur) paintArea(cur, 1, cur.start + RISE + SPREAD + 1);
    }

    var frames = 0, safety = null;

    function frame() {
      frames++;
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(base, 0, 0, W, H);

      var busy = false;
      if (prev) {
        var pt = (now - prev.fadeStart) / FADE;
        if (pt >= 1) { prev = null; }
        else { paintArea(prev, 1 - pt, now); busy = true; }
      }
      if (cur) {
        paintArea(cur, 1, now);
        if (now - cur.start < RISE + SPREAD) busy = true;
      }
      raf = busy ? window.requestAnimationFrame(frame) : null;
    }

    function render() {
      if (raf) return;
      raf = window.requestAnimationFrame(frame);
    }

    /* If no frame has run by the time the animation should have finished,
       rAF is not being serviced - fall back to drawing the settled state. */
    function armSafety() {
      frames = 0;
      window.clearTimeout(safety);
      safety = window.setTimeout(function () {
        if (frames === 0) paintStatic();
      }, RISE + SPREAD + 250);
    }

    function lightUp(idx) {
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      if (cur && cur.idx !== idx) { prev = cur; prev.fadeStart = now; }
      cur = { idx: idx, start: prefersReduced() ? now - (RISE + SPREAD) : now };
      render();
      armSafety();
    }

    function lightOff() {
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      if (cur) { prev = cur; prev.fadeStart = now; cur = null; }
      render();
      armSafety();
    }

    /* ---- markers and the self-running tour -------------------------------- */
    var entries = [];          /* { btn, item, idx } in west-to-east order */
    var active = null;
    /* inView starts true on purpose. Gating the tour on an observer that has
       not reported yet means a callback that never arrives leaves the map
       permanently silent; starting optimistically and letting the observer
       PAUSE it fails the safe way instead. */
    var tour = null, tourIdx = -1, userTookOver = false, inView = true, toured = false;

    /* An aria-live region that changes every couple of seconds is hostile to
       a screen reader, so the tour runs silently and the region only becomes
       live once a person drives it. */
    function setLive(on) {
      if (on) readout.setAttribute('aria-live', 'polite');
      else readout.removeAttribute('aria-live');
    }

    function apply(entry) {
      if (active && active !== entry.btn) {
        active.classList.remove('is-active');
        active.setAttribute('aria-pressed', 'false');
      }
      entry.btn.classList.add('is-active');
      entry.btn.setAttribute('aria-pressed', 'true');
      active = entry.btn;
      place.textContent = entry.item.name;
      detail.textContent = entry.item.detail || '';
      lightUp(entry.idx);
    }

    function clear() {
      if (active) {
        active.classList.remove('is-active');
        active.setAttribute('aria-pressed', 'false');
        active = null;
      }
      place.textContent = 'Select a marker';
      detail.textContent = '';
      lightOff();
    }

    function step() {
      if (!entries.length) return;
      tourIdx = (tourIdx + 1) % entries.length;
      apply(entries[tourIdx]);
    }

    function startTour() {
      if (tour || userTookOver || !inView || prefersReduced() || document.hidden) return;
      setLive(false);
      /* setInterval does not fire until a whole interval has passed, so the
         first region used to arrive 2.2s AFTER the already-delayed start -
         about three and a half seconds of an empty map. Step once up front and
         let the interval take over from there.

         Only on the very first run: resuming after a hover should carry on at
         the normal pace rather than jumping straight to the next country. */
      if (!toured) { toured = true; step(); }
      tour = window.setInterval(step, 2200);
    }
    function pauseTour() {
      if (!tour) return;
      window.clearInterval(tour); tour = null; setLive(true);
    }
    function endTour() { pauseTour(); userTookOver = true; setLive(true); }

    PRESENCE.map(function (item, idx) { return { item: item, idx: idx }; })
      .sort(function (a, b) { return a.item.lon - b.item.lon; })
      .forEach(function (rec, i) {
        var item = rec.item;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'worldmap__pin';
        btn.style.left = presenceX(item.lon).toFixed(3) + '%';
        btn.style.top  = presenceY(item.lat).toFixed(3) + '%';
        btn.style.setProperty('--pin-delay', (0.25 + i * 0.07).toFixed(3) + 's');
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', item.detail ? item.name + ' — ' + item.detail.replace(/ · /g, ', ') : item.name);
        var entry = { btn: btn, item: item, idx: rec.idx };
        on(btn, 'click', function () {
          endTour();
          if (active === btn) clear(); else apply(entry);
        });
        on(btn, 'focus', pauseTour);
        pinbox.appendChild(btn);
        entries.push(entry);
      });

    /* Hovering the map is a signal someone is reading it. */
    on(wrap, 'pointerenter', pauseTour);
    on(wrap, 'pointerleave', function () { if (!userTookOver) startTour(); });
    on(document, 'visibilitychange', function () {
      if (document.hidden) pauseTour(); else startTour();
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          inView = e.isIntersecting;
          if (inView) window.setTimeout(startTour, 1100);
          else pauseTour();
        });
      }, { threshold: 0.25 });
      io.observe(wrap);
    } else {
      window.setTimeout(startTour, 1100);
    }

    build();
    render();
    on(window, 'resize', rafThrottle(function () { build(); render(); }), { passive: true });
    on(window, 'kneo:theme', function () { build(); render(); });
  }

  function initReveal() {
    var items = $$('[data-reveal]');
    if (!items.length) return;

    if (prefersReduced() || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    // Auto-stagger children of [data-reveal-group]
    $$('[data-reveal-group]').forEach(function (group) {
      var step = parseFloat(group.getAttribute('data-reveal-group')) || 0.08;
      $$('[data-reveal]', group).forEach(function (child, i) {
        if (!child.style.getPropertyValue('--reveal-delay')) {
          child.style.setProperty('--reveal-delay', (i * step).toFixed(3) + 's');
        }
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });

    /* ---- Safety nets -------------------------------------------------
       Reveal animations must never be able to leave content invisible.
       1. A geometry sweep on scroll/resize/visibilitychange, which also
          covers pages loaded in a background tab where IntersectionObserver
          callbacks are deferred until the tab is focused.
       2. A last-resort check: if nothing at all has been revealed a few
          seconds after boot, the observer is not working — show everything.
       ------------------------------------------------------------------ */
    function sweep() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      items.forEach(function (el) {
        if (el.classList.contains('is-visible')) return;
        var r = el.getBoundingClientRect();
        /* Anything at or above the fold — including content the reader has
           already scrolled past via an anchor jump, End key or a restored
           scroll position — must be shown, never left stranded. */
        if (r.top < vh * 0.94) {
          el.classList.add("is-visible");
          io.unobserve(el);
        }
      });
    }

    var throttledSweep = throttle(sweep, 90);
    on(window, 'scroll', throttledSweep, { passive: true });
    on(window, 'resize', throttledSweep, { passive: true });
    on(window, 'load', sweep);
    on(document, 'visibilitychange', function () { if (!document.hidden) sweep(); });
    window.setTimeout(sweep, 1200);

    window.setTimeout(function () {
      if (document.querySelector('[data-reveal].is-visible')) return;
      items.forEach(function (el) { el.classList.add('is-visible'); });
    }, 4000);
  }

  /* ========================================================================
     6. SPLIT-TEXT HEADLINE REVEAL
     ==================================================================== */

  function initSplitText() {
    var targets = $$('[data-split]');
    if (!targets.length) return;

    targets.forEach(function (el) {
      if (el.dataset.splitDone) return;
      el.dataset.splitDone = '1';
      el.classList.add('reveal-text');

      var nodes = Array.prototype.slice.call(el.childNodes);
      var frag = document.createDocumentFragment();
      var index = 0;

      function wrapWords(text, wrapper) {
        var words = text.split(/(\s+)/);
        words.forEach(function (w) {
          if (!w) return;
          if (/^\s+$/.test(w)) { wrapper.appendChild(document.createTextNode(' ')); return; }
          var outer = document.createElement('span');
          outer.className = 'word';
          var inner = document.createElement('span');
          inner.textContent = w;
          inner.style.setProperty('--word-delay', (index * 0.055).toFixed(3) + 's');
          index++;
          outer.appendChild(inner);
          wrapper.appendChild(outer);
        });
      }

      /* Walk the tree rather than flattening it.
         The old version shallow-cloned each element and rebuilt it from
         textContent, which threw away anything nested inside - fine while
         headlines were plain, but it silently destroys markup that has to
         survive, like the word rotator. An element marked data-nosplit is
         taken whole and still takes its turn in the stagger. */
      function walk(list, target) {
        Array.prototype.slice.call(list).forEach(function (node) {
          if (node.nodeType === 3) { wrapWords(node.textContent, target); return; }
          if (node.nodeType !== 1) return;

          if (node.hasAttribute && node.hasAttribute('data-nosplit')) {
            var outer = document.createElement('span');
            outer.className = 'word';
            var keep = node.cloneNode(true);
            keep.style.setProperty('--word-delay', (index * 0.055).toFixed(3) + 's');
            index++;
            outer.appendChild(keep);
            target.appendChild(outer);
            return;
          }

          var clone = node.cloneNode(false);
          walk(node.childNodes, clone);
          target.appendChild(clone);
        });
      }
      walk(nodes, frag);

      el.textContent = '';
      el.appendChild(frag);
    });

    if (prefersReduced() || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.2 });

    targets.forEach(function (el) { io.observe(el); });

    // Same safety net as the reveal system: a headline must never stay hidden.
    function sweep() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      targets.forEach(function (el) {
        if (el.classList.contains('is-visible')) return;
        var r = el.getBoundingClientRect();
        if (r.top < vh) { el.classList.add("is-visible"); io.unobserve(el); }
      });
    }
    on(window, 'scroll', throttle(sweep, 90), { passive: true });
    on(window, 'load', sweep);
    on(document, 'visibilitychange', function () { if (!document.hidden) sweep(); });
    window.setTimeout(sweep, 1000);
    window.setTimeout(function () {
      targets.forEach(function (el) { el.classList.add('is-visible'); });
    }, 4000);
  }

  /* ========================================================================
     6b. WORD ROTATOR
     ==================================================================== */

  /* Swaps one word of a headline on a timer: the current word rides up and
     out while the next rises into its place.

     Two things make this harder than it looks.

     Width. "Digital" and "Smart" are not the same size, and the hero is
     centred, so a naive swap would shunt the rest of the line sideways on
     every change. The words are measured and the box is animated between
     those widths, so the line glides instead of jumping.

     Screen readers. A heading whose text mutates every three seconds is
     hostile to anyone listening to it. The moving parts are hidden from the
     accessibility tree entirely and one stable word is exposed in their
     place, so the heading reads as a single sentence and never announces a
     change nobody asked for. */
  function initWordCycle() {
    $$('[data-words]').forEach(function (el) {
      if (el.dataset.cycleDone) return;

      var words = (el.getAttribute('data-words') || '')
        .split('|')
        .map(function (w) { return w.trim(); })
        .filter(Boolean);
      if (words.length < 2) return;
      el.dataset.cycleDone = '1';

      /* Pin the heading's accessible name BEFORE touching anything, while the
         DOM still reads as one clean sentence. Relying on aria-hidden to keep
         the spare words out of the name is not enough - the name is computed
         from contents, engines differ at the edges, and the heading was in
         fact announcing "DigitalDigitalSmart Manufacturing". Reading it off
         the live DOM rather than hard-coding a string means it cannot drift
         when the surrounding copy is edited. */
      var host = el.closest && el.closest('h1,h2,h3,h4,h5,h6,p,.lead');
      if (host && !host.hasAttribute('aria-label')) {
        var name = host.textContent.replace(/\s+/g, ' ').trim();
        if (name) host.setAttribute('aria-label', name);
      }

      el.classList.add('wordcycle');
      el.textContent = '';

      var track = document.createElement('span');
      track.className = 'wordcycle__track';
      track.setAttribute('aria-hidden', 'true');

      var spans = words.map(function (w, i) {
        var s = document.createElement('span');
        s.className = 'wordcycle__word' + (i === 0 ? ' is-current' : '');
        s.textContent = w;
        track.appendChild(s);
        return s;
      });
      el.appendChild(track);

      var idx = 0, widths = [], timer = null, clear = null, running = false;

      /* Each word is taken out of flow, so its box shrinks to its own text
         and reports the width we need. Re-measured on resize because the
         headline size is a clamp() and moves with the viewport. */
      function measure() {
        widths = spans.map(function (s) { return s.getBoundingClientRect().width; });
        el.style.width = widths[idx] ? widths[idx].toFixed(1) + 'px' : '';
      }

      function step() {
        var from = idx;
        idx = (idx + 1) % spans.length;
        spans[from].classList.remove('is-current');
        spans[from].classList.add('is-out');
        spans[idx].classList.remove('is-out');
        spans[idx].classList.add('is-current');
        if (widths[idx]) el.style.width = widths[idx].toFixed(1) + 'px';
        // Park the outgoing word below again once it is out of sight, so it
        // is ready to rise on its next turn.
        window.clearTimeout(clear);
        clear = window.setTimeout(function () {
          spans[from].classList.remove('is-out');
        }, 700);
      }

      function start() {
        // Never run while the tab is in the background: the browser clamps
        // timers there, and an interval created under that clamp stays slow
        // even after the tab comes forward.
        if (running || prefersReduced() || document.hidden) return;
        running = true;
        timer = window.setInterval(step, 3000);
      }
      function stop() {
        running = false;
        window.clearInterval(timer);
        timer = null;
      }

      measure();
      // Measure again once the display face is actually in use - measuring
      // against a fallback font gives the wrong widths and the line settles
      // with a visible nudge.
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(measure).catch(function () {});
      }
      on(window, 'resize', rafThrottle(measure), { passive: true });

      if (prefersReduced()) return;      // one word, no motion

      /* Tear the timer down and build a fresh one rather than leaving the old
         one to pick up where it left off - a page opened in a background tab
         gets its interval clamped, and simply calling start() again would do
         nothing because it is already "running". */
      on(document, 'visibilitychange', function () {
        stop();
        if (!document.hidden) start();
      });

      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
        }, { threshold: 0 });
        io.observe(el);
      } else {
        start();
      }
    });
  }

  /* ========================================================================
     7. ANIMATED COUNTERS
     ==================================================================== */

  function initCounters() {
    var counters = $$('[data-count]');
    if (!counters.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      if (isNaN(target)) return;
      var decimals = (el.getAttribute('data-decimals') | 0);
      function settle() { el.textContent = target.toFixed(decimals); }
      if (prefersReduced()) { settle(); return; }

      var duration = parseInt(el.getAttribute('data-duration'), 10) || 1600;
      var start = null, done = false;

      /* However the animation ends - or fails to - the real number is on
         screen shortly afterwards. requestAnimationFrame does not run in a
         backgrounded tab, and the observer above has already unobserved this
         element, so without this there is no second chance. */
      var safety = window.setTimeout(function () {
        if (!done) { done = true; settle(); }
      }, duration + 1500);

      // Zero it only now, at the moment we are actually going to count up.
      el.textContent = '0';

      function frame(ts) {
        if (done) return;
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        // easeOutExpo
        var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        el.textContent = (target * eased).toFixed(decimals);
        if (p < 1) window.requestAnimationFrame(frame);
        else { done = true; window.clearTimeout(safety); settle(); }
      }
      window.requestAnimationFrame(frame);
    }

    if (!('IntersectionObserver' in window)) { counters.forEach(run); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    /* Observe, but do NOT blank the numbers first.
       They used to be set to '0' here, the instant the script ran, which threw
       away the correct figure that was already in the HTML and made the page
       depend on BOTH the observer firing AND rAF running to put it back. If
       either failed, the site's headline proof - 23+ years, 400+ projects -
       simply read zero, and nothing ever corrected it. Left alone, the markup
       is its own fallback. */
    counters.forEach(function (el) { io.observe(el); });
  }

  /* ========================================================================
     8. ACCORDIONS
     ==================================================================== */

  function initAccordions() {
    $$('.accordion').forEach(function (acc) {
      var single = acc.hasAttribute('data-single');
      var items = $$('.accordion__item', acc);

      items.forEach(function (item, i) {
        var trigger = $('.accordion__trigger', item);
        var panel = $('.accordion__panel', item);
        if (!trigger || !panel) return;

        var pid = panel.id || ('acc-panel-' + Math.random().toString(36).slice(2, 8));
        panel.id = pid;
        trigger.setAttribute('aria-controls', pid);
        trigger.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');

        on(trigger, 'click', function () {
          var willOpen = !item.classList.contains('is-open');
          if (single && willOpen) {
            items.forEach(function (other) {
              if (other === item) return;
              other.classList.remove('is-open');
              var t = $('.accordion__trigger', other);
              if (t) t.setAttribute('aria-expanded', 'false');
            });
          }
          item.classList.toggle('is-open', willOpen);
          trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });
      });
    });
  }

  /* ========================================================================
     9. TABS
     ==================================================================== */

  function initTabs() {
    $$('[data-tabs]').forEach(function (root) {
      var buttons = $$('.tabs__btn', root);
      var panels = $$('.tabs__panel', root);
      if (!buttons.length) return;

      function activate(idx) {
        buttons.forEach(function (b, i) {
          b.classList.toggle('is-active', i === idx);
          b.setAttribute('aria-selected', i === idx ? 'true' : 'false');
          b.setAttribute('tabindex', i === idx ? '0' : '-1');
        });
        panels.forEach(function (p, i) {
          p.classList.toggle('is-active', i === idx);
          p.hidden = i !== idx;
        });
      }

      buttons.forEach(function (btn, i) {
        btn.setAttribute('role', 'tab');
        on(btn, 'click', function () { activate(i); });
        on(btn, 'keydown', function (e) {
          var next = null;
          if (e.key === 'ArrowRight') next = (i + 1) % buttons.length;
          if (e.key === 'ArrowLeft') next = (i - 1 + buttons.length) % buttons.length;
          if (next !== null) { e.preventDefault(); activate(next); buttons[next].focus(); }
        });
      });
      panels.forEach(function (p) { p.setAttribute('role', 'tabpanel'); });
      activate(0);
    });
  }

  /* ========================================================================
     10. IN-PAGE SUB-NAV SCROLLSPY
     ==================================================================== */

  function initScrollspy() {
    var nav = $('.subnav');
    if (!nav) return;
    var links = $$('a[href^="#"]', nav);
    if (!links.length) return;

    var sections = links.map(function (a) {
      var id = a.getAttribute('href').slice(1);
      return id ? document.getElementById(id) : null;
    });

    var update = throttle(function () {
      var offset = (nav.getBoundingClientRect().height || 0) + 110;
      var activeIdx = 0;
      sections.forEach(function (sec, i) {
        if (sec && sec.getBoundingClientRect().top <= offset) activeIdx = i;
      });
      links.forEach(function (a, i) { a.classList.toggle('is-active', i === activeIdx); });
    }, 100);

    on(window, "scroll", update, { passive: true });
    update();
  }

  /* ========================================================================
     11. PARALLAX
     ==================================================================== */

  function initParallax() {
    var els = $$('[data-parallax]');
    if (!els.length || prefersReduced()) return;

    var update = rafThrottle(function () {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.12;
        var progress = (rect.top + rect.height / 2 - vh / 2) / vh;
        el.style.transform = 'translate3d(0,' + (progress * speed * 100).toFixed(2) + 'px,0)';
      });
    });

    on(window, 'scroll', update, { passive: true });
    on(window, 'resize', update, { passive: true });
    update();
  }

  /* ========================================================================
     12. HERO BACKGROUND
     --------------------------------------------------------------------
     Strategy: a generated canvas visual always renders (zero external
     dependencies, always works offline). If an optional MP4 has been
     dropped into /assets/video/ AND it actually loads, it fades in on top.
     Nothing 404s visibly; nothing shifts layout.
     ==================================================================== */

  function initHeroVideo() {
    $$('[data-hero-video]').forEach(function (video) {
      var src = video.getAttribute('data-hero-video');
      if (!src) return;
      // Skip heavy video on small screens / data saver / reduced motion
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (prefersReduced() || window.innerWidth < 760 || (conn && conn.saveData)) return;
      /* And not over a slow link. This file is 26MB; on 2g or 3g it would
         still be arriving long after the visitor has read the page, taking
         bandwidth from everything they actually navigate to. */
      if (conn && /(^|-)[23]g$/.test(conn.effectiveType || '')) return;

      // Load the real element directly.
      //
      // This used to load a throwaway probe first and only then set src on the
      // visible element. That could never work: the element carries
      // preload="none", and assigning src to a preload="none" video does not
      // start a fetch - it sits in networkState IDLE forever, so 'loadeddata'
      // never fired and the class below was never added. The probe also meant
      // fetching the whole file twice.
      //
      // Probing was never needed anyway: the element is transparent until
      // is-ready is set, so a file that is missing or slow simply never fades
      // in, and the generated canvas keeps the hero.
      function begin() {
        var settled = false;
        /* Giving up has to STOP THE FETCH, not just decline to fade it in.
           Before this the timeout only set a flag: a 26MB download carried on
           in the background for the rest of the visit, competing with every
           image and page the visitor went on to load. */
        var timer = window.setTimeout(function () {
          settled = true;
          video.removeAttribute('src');
          try { video.load(); } catch (e) {}
        }, 8000);

        video.addEventListener('loadeddata', function () {
          if (settled) return;            // too slow - leave the canvas alone
          window.clearTimeout(timer);
          settled = true;
          video.classList.add('is-ready');
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
        }, { once: true });

        video.addEventListener('error', function () {
          settled = true;
          window.clearTimeout(timer);
        }, { once: true });

        /* Assigning src is enough once preload is 'auto'. The explicit load()
           that used to follow it started a SECOND request and aborted the
           first, so every desktop visit fetched the opening of a 25MB file
           twice. Verified: src alone reaches readyState 4. */
        video.preload = 'auto';
        video.src = src;
      }

      /* Start it after the page has finished, not during.
         This is decoration on top of a hero that already works, but it is by
         far the heaviest thing the site requests - and it was being requested
         immediately, competing with the stylesheet, the script and the fonts
         for the same connections while the visitor was still waiting to see
         anything. Waiting for load, then for the main thread to go quiet,
         costs the video a second or two and costs the page nothing. */
      function whenIdle(fn) {
        if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 3000 });
        else window.setTimeout(fn, 400);
      }
      if (document.readyState === 'complete') whenIdle(begin);
      else on(window, 'load', function () { whenIdle(begin); });
    });
  }

  /* Shared cursor state for the hero. Written by the hero's pointer tracker,
     read by the canvas draw loop so the node network can respond to the cursor.
     Hero-local pixel coordinates; `active` is false on touch and reduced motion. */
  var heroPointer = { x: 0, y: 0, active: false };

  /* --------------------------------------------------------------------------
     Shared cursor tracker.

     Handles the media-query guards, easing, frame scheduling and visibility
     gating in one place, so any surface can react to the pointer without
     repeating that logic. Returns null when cursor motion is not appropriate
     (touch device, or the visitor asked for reduced motion), which lets callers
     skip their own setup entirely.

       onUpdate(x, y, rect)  eased cursor position, element-local pixels
       onEnter()             pointer entered the surface
       onLeave()             pointer left — reset any transforms here
     -------------------------------------------------------------------------- */
  function createPointerTracker(el, onUpdate, onEnter, onLeave) {
    if (!el) return null;

    // Motion tied to a cursor is meaningless without one, and unwanted when the
    // visitor has asked for reduced motion.
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (prefersReduced() || !fine.matches) return null;

    var tx = 0, ty = 0;   // target, element-local pixels
    var cx = 0, cy = 0;   // current (eased)
    var seeded = false, raf = null, running = false, inView = true;

    function frame() {
      // Critically damped follow — the effect trails the cursor rather than
      // snapping to it, which is what makes the movement read as premium.
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      onUpdate(cx, cy, el.getBoundingClientRect());
      // Idle once it has caught up, so we are not burning frames.
      if (Math.abs(tx - cx) < 0.4 && Math.abs(ty - cy) < 0.4) { stop(); return; }
      raf = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running || !inView) return;
      running = true;
      raf = window.requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = null;
    }
    function standDown() {
      el.classList.remove('is-pointing');
      seeded = false;
      stop();
      if (onLeave) onLeave();
    }

    on(el, 'mousemove', function (e) {
      var r = el.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      if (!seeded) { cx = tx; cy = ty; seeded = true; el.classList.add('is-pointing'); }
      start();
    });
    on(el, 'mouseenter', function () {
      el.classList.add('is-pointing');
      if (onEnter) onEnter();
    });
    on(el, 'mouseleave', standDown);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { inView = e.isIntersecting; if (!inView) stop(); });
      }, { threshold: 0 }).observe(el);
    }
    on(document, 'visibilitychange', function () { if (document.hidden) stop(); });

    // If the visitor turns reduced motion on mid-session, stand down.
    var mqHandler = function () { if (prefersReduced()) standDown(); };
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', mqHandler);
    else if (reduceMotion.addListener) reduceMotion.addListener(mqHandler);

    return { stop: stop };
  }

  /* Every page gets the same reactive backdrop as the home hero.
     The canvas and the light are injected rather than written into 39 page
     sources — they are purely decorative, so they belong with the behaviour,
     and this keeps the markup identical everywhere. Runs before the canvas and
     pointer modules so they find what they expect. */
  function initHeroBackdrops() {
    $$('.hero, .page-hero, .error-page').forEach(function (hero) {
      if ($('.hero__canvas', hero)) return;   // the home hero already has one

      var bg = document.createElement('div');
      bg.className = 'hero__bg';
      bg.setAttribute('aria-hidden', 'true');

      var spot = document.createElement('div');
      spot.className = 'hero__spot';
      bg.appendChild(spot);
      hero.insertBefore(bg, hero.firstChild);

      /* The canvas is a sibling of .hero__bg, not a child of it. .hero__bg is
         z-index -2 and so opens its own stacking context; a canvas inside it
         can never rise above the readability overlay. Placed after the bg it
         paints on top of that layer while still sitting behind hero text. */
      var canvas = document.createElement('canvas');
      canvas.className = 'hero__canvas';
      canvas.setAttribute('aria-hidden', 'true');
      hero.insertBefore(canvas, bg.nextSibling);
    });
  }

  function initHeroPointer() {
    // One hero per page: the home hero, an inner page hero, or the 404 panel.
    var hero = $('.hero') || $('.page-hero') || $('.error-page');
    if (!hero) return;
    var spot = $('.hero__spot', hero);
    var bg = $('.hero__bg', hero);

    createPointerTracker(hero,
      function (x, y, r) {
        if (spot) spot.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
        if (bg && r.width && r.height) {
          var nx = (x / r.width) * 2 - 1;
          var ny = (y / r.height) * 2 - 1;
          bg.style.transform = 'translate3d(' + (nx * -14).toFixed(2) + 'px,' + (ny * -10).toFixed(2) + 'px,0) scale(1.03)';
        }
        heroPointer.x = x;
        heroPointer.y = y;
      },
      function () { heroPointer.active = true; },
      function () {
        heroPointer.active = false;
        if (bg) bg.style.transform = '';
      }
    );
  }

  /* Accent CTA bands: the grid drifts with the cursor and a soft light follows
     it. The light element is injected rather than written into all 40 pages —
     it is purely decorative, so it belongs with the behaviour, not the content. */
  function initCtaPointer() {
    $$('.cta-band').forEach(function (band) {
      var grid = $('.bg-grid', band);

      var spot = document.createElement('span');
      spot.className = 'cta-band__spot';
      spot.setAttribute('aria-hidden', 'true');
      band.insertBefore(spot, band.firstChild);

      var tracker = createPointerTracker(band,
        function (x, y, r) {
          spot.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
          if (grid && r.width && r.height) {
            var nx = (x / r.width) * 2 - 1;
            var ny = (y / r.height) * 2 - 1;
            grid.style.transform = 'translate3d(' + (nx * 16).toFixed(2) + 'px,' + (ny * 12).toFixed(2) + 'px,0)';
          }
        },
        null,
        function () { if (grid) grid.style.transform = ''; }
      );

      // Cursor motion is switched off for this visitor — do not leave a stray
      // decorative element in the DOM.
      if (!tracker) spot.remove();
    });
  }

  /* ------------------------------------------------------------------------
     Hero backdrop — drifting light.

     Two layers: a few very large, very soft colour glows that wander, and a
     field of small motes that drift and twinkle over them. Generated per
     visit, so it is unique to this site and costs nothing to download.

     WHY NOT LINES. Earlier versions drew a rail, then rings, then trailing
     streaks. Rendered out and looked at side by side, the trails read as
     sparks on the navy but as scratches or hair on the white — thin dark
     strokes on a light ground always do. Soft-edged glows and round motes
     cannot scratch, which is the only way to make one design work on both
     grounds.

     BOTH THEMES are tuned separately and were checked by rendering each one:
     the glows are lifted and the motes darkened for the white ground.

     PERFORMANCE. The glows are large gradient fills, which are the expensive
     part. They move slowly enough that repainting them every frame is waste,
     so they are cached to an offscreen canvas and refreshed occasionally,
     while the cheap motes are drawn fresh each frame.
     ---------------------------------------------------------------------- */
  function initHeroCanvas() {
    var canvas = $('.hero__canvas');
    if (!canvas) return;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, raf = null, running = false, tick = 0;
    var orbs = [], motes = [], pal = {};
    var glow = document.createElement('canvas');
    var gctx = glow.getContext('2d');

    function readPalette() {
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      pal = light
        ? { hues: [[255,120,70],[96,132,205]], orb: 0.16,
            mote: [40,48,80], moteA: 0.55 }
        : { hues: [[255,106,61],[70,110,200]], orb: 0.13,
            mote: [205,216,248], moteA: 0.60 };
    }

    function build() {
      var rect = canvas.getBoundingClientRect();
      w = Math.max(rect.width, 1);
      h = Math.max(rect.height, 1);
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      glow.width = canvas.width;
      glow.height = canvas.height;
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      orbs = [];
      for (var i = 0; i < 5; i++) {
        orbs.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: w * (0.28 + Math.random() * 0.22),
          hue: i % 2,
          a: pal.orb * (0.6 + Math.random() * 0.4),
          vx: (Math.random() - 0.5) * 0.16,
          vy: (Math.random() - 0.5) * 0.13
        });
      }

      var n = Math.round((w * h) / 2900);
      n = Math.max(60, Math.min(n, 240));
      motes = [];
      for (var j = 0; j < n; j++) {
        motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.9 + Math.random() * 1.5,
          a: 0.35 + Math.random() * 0.65,
          warm: Math.random() < 0.22,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.18 - 0.04,
          ph: Math.random() * Math.PI * 2,
          sp: 0.006 + Math.random() * 0.012
        });
      }
      paintGlow();
    }

    /* The expensive layer, repainted only now and then. */
    function paintGlow() {
      gctx.clearRect(0, 0, w, h);
      for (var i = 0; i < orbs.length; i++) {
        var o = orbs[i], c = pal.hues[o.hue];
        var grd = gctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        grd.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + o.a.toFixed(3) + ')');
        grd.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        gctx.fillStyle = grd;
        gctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
      }
    }

    function draw() {
      tick++;
      ctx.clearRect(0, 0, w, h);

      /* drift the glows, refresh their cache every eighth frame */
      for (var i = 0; i < orbs.length; i++) {
        var o = orbs[i];
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.r) o.x = w + o.r; else if (o.x > w + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = h + o.r; else if (o.y > h + o.r) o.y = -o.r;
      }
      if (tick % 8 === 0) paintGlow();
      ctx.drawImage(glow, 0, 0, w, h);

      var px = heroPointer.active ? heroPointer.x : -9999;
      var py = heroPointer.active ? heroPointer.y : -9999;

      for (var j = 0; j < motes.length; j++) {
        var m = motes[j];
        m.x += m.vx; m.y += m.vy; m.ph += m.sp;

        if (m.x < -6) m.x = w + 6; else if (m.x > w + 6) m.x = -6;
        if (m.y < -6) m.y = h + 6; else if (m.y > h + 6) m.y = -6;

        var boost = 0;
        if (heroPointer.active) {
          var dx = m.x - px, dy = m.y - py;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < 170) {
            boost = 1 - d / 170;
            m.x += (dx / (d || 1)) * boost * 0.45;
            m.y += (dy / (d || 1)) * boost * 0.45;
          }
        }

        /* a slow twinkle, so the field breathes rather than sits still */
        var tw = 0.72 + 0.28 * Math.sin(m.ph);
        var c = m.warm ? pal.hues[0] : pal.mote;
        var a = Math.min(1, pal.moteA * m.a * tw + boost * 0.45);

        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r + boost * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = window.requestAnimationFrame(draw);
    }

    /* Reduced motion: one still frame, no drift and no twinkle. */
    function drawStill() {
      ctx.clearRect(0, 0, w, h);
      paintGlow();
      ctx.drawImage(glow, 0, 0, w, h);
      for (var j = 0; j < motes.length; j++) {
        var m = motes[j];
        var c = m.warm ? pal.hues[0] : pal.mote;
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (pal.moteA * m.a).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* This backdrop was built for a hero that had no footage behind it. With
       the video in place the white theme gets both at once, and the warm
       glows and motes stop reading as atmosphere and start reading as haze
       and dust over the picture. The navy still wants them - the footage sits
       much further back there - so it is switched per theme rather than
       deleted. */
    function backdropWanted() {
      return document.documentElement.getAttribute('data-theme') !== 'light';
    }

    function clear() { ctx.clearRect(0, 0, w, h); }

    function start() {
      if (running || prefersReduced() || !backdropWanted()) return;
      running = true;
      raf = window.requestAnimationFrame(draw);
    }
    function stop() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = null;
    }

    readPalette();
    build();

    if (!backdropWanted()) clear();
    else if (prefersReduced()) drawStill();
    else start();

    on(window, 'resize', rafThrottle(function () {
      build();
      if (!backdropWanted()) clear();
      else if (prefersReduced()) drawStill();
    }), { passive: true });
    on(window, 'kneo:theme', function () {
      readPalette();
      if (!backdropWanted()) {
        // Stop first: a frame already scheduled would repaint over the wipe.
        stop();
        clear();
        return;
      }
      for (var i = 0; i < orbs.length; i++) orbs[i].a = pal.orb * (0.6 + Math.random() * 0.4);
      paintGlow();
      if (prefersReduced()) drawStill();
      else start();
    });
    on(document, 'visibilitychange', function () { document.hidden ? stop() : start(); });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
      }, { threshold: 0 });
      io.observe(canvas);
    }
  }

  /* ========================================================================
     13b. ENQUIRY ROUTING & QUALIFICATION
     ==================================================================== */

  /* Two jobs, both aimed at the same thing: fewer enquiries that need a round
     of email before anyone can act on them.

     Routing. Any link on the site can carry ?req=<value> - or #req=<value> -
     and the contact form arrives with that requirement already chosen. It
     means a CTA on the MAPP page can send someone to a form that already
     knows what they were reading about, rather than dropping them at a blank
     dropdown on a page about everything.

     Qualification. The extra fields stay hidden until a requirement is picked,
     so the form looks short on arrival and only asks for detail once the
     visitor has committed to a subject. The technical pair is hidden entirely
     for enquiries where it would be nonsense - nobody applying for a job needs
     to tell us which PLC they run. */
  function initEnquiryRouting() {
    var picker = $('[data-req-picker]');
    if (!picker) return;

    var qualify = $('[data-qualify]');
    var tech    = $('[data-qualify-tech]');

    /* Requirements where asking about installed controls and plant location
       makes sense. Everything else gets the shorter form. */
    var TECHNICAL = {
      automation: 1, programming: 1, electrical: 1, 'virtual-commissioning': 1,
      ignition: 1, mapp: 1, quality: 1, 'cycle-time': 1, retrofit: 1,
      commissioning: 1
    };

    function sync() {
      var v = picker.value;
      if (qualify) qualify.hidden = !v;
      if (tech) tech.hidden = !(v && TECHNICAL[v]);
    }

    on(picker, 'change', sync);

    /* Preselect from the URL. Accepts ?req= and #req= so a plain anchor works
       as well as a query string. Matched case-insensitively against the option
       values, and ignored silently if it names something that is not there. */
    var wanted = '';
    try {
      wanted = (new URLSearchParams(window.location.search).get('req') || '').toLowerCase();
    } catch (e) { /* no URLSearchParams - fall through to the hash */ }
    if (!wanted) {
      var m = window.location.hash.match(/req=([\w-]+)/);
      if (m) wanted = m[1].toLowerCase();
    }

    if (wanted) {
      var matched = false;
      for (var i = 0; i < picker.options.length; i++) {
        if (picker.options[i].value.toLowerCase() === wanted) {
          picker.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (matched) {
        /* Arriving with the subject already answered, the next thing they need
           is the box to describe it in. */
        var msg = $('#f-message');
        if (msg && !prefersReduced()) {
          window.setTimeout(function () {
            try { msg.focus({ preventScroll: true }); } catch (e) { msg.focus(); }
          }, 300);
        }
      }
    }

    sync();
  }

  /* ========================================================================
     13. FORMS
     ==================================================================== */

  /* ====================================================================
     13. FORMS & WHATSAPP WIDGET
     ==================================================================== */

  var PABBLY_WEBHOOK_URL = 'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjcwNTZlMDYzMzA0MzI1MjY0NTUzYzUxMzUi_pc';
  var CRM_ENDPOINT = 'https://kneocentralbackend.mesplatform.com/api/crm/leads';
  var CRM_API_KEY = 'kneo_crm_B5FjzBSMRzSik9ddwBn9A-Wfv-t5-A-oif7m_KPoZns';

  function initForms() {
    // 1. WhatsApp / Contact Modal Controls
    var waBtn = document.getElementById('kneoWaBtn');
    var modal = document.getElementById('kneoLeadModal');
    var modalClose = document.getElementById('kneoModalClose');

    function openModal(defaultService) {
      if (!modal) return;
      modal.removeAttribute('hidden');
      requestAnimationFrame(function () {
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      });
      if (defaultService) {
        var svcSelect = modal.querySelector('select[name="service"]');
        if (svcSelect) {
          svcSelect.value = defaultService;
        }
      }
      var nameInput = modal.querySelector('input[name="name"]');
      if (nameInput) setTimeout(function () { nameInput.focus(); }, 120);
    }

    function closeModal() {
      if (!modal) return;
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(function () {
        modal.setAttribute('hidden', '');
      }, 280);
    }

    if (waBtn) {
      waBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    }

    if (modalClose) {
      modalClose.addEventListener('click', function (e) {
        e.preventDefault();
        closeModal();
      });
    }

    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && modal.classList.contains('is-open')) {
        closeModal();
      }
    });

    // Wire up all "Book Discovery Session", "Request Demo", or modal CTA triggers across the site
    var ctaSelectors = '[data-open-modal], [data-demo-btn], a[href="#contact-modal"], a[aria-label="Contact us on WhatsApp"], button[aria-label="Contact us on WhatsApp"]';
    document.querySelectorAll(ctaSelectors).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var svc = btn.getAttribute('data-service') || btn.getAttribute('data-req') || '';
        openModal(svc);
      });
    });

    // 2. Reusable Lead Form Submission
    document.querySelectorAll('form[data-kneo-lead-form], form.kneo-lead-form, form[data-form]').forEach(function (form) {
      var status = form.querySelector('.form__status');
      var submit = form.querySelector('[type="submit"]');

      function setStatus(kind, message) {
        if (!status) return;
        status.className = 'form__status is-visible form__status--' + kind;
        status.textContent = message;
        status.setAttribute('role', 'status');
      }

      // Live-clear field errors
      form.querySelectorAll('.field').forEach(function (field) {
        var ctrl = field.querySelector('input, textarea, select');
        if (!ctrl) return;
        ctrl.addEventListener('input', function () { field.classList.remove('has-error'); });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Bot protection: honeypot
        var hp = form.querySelector('[name="website"], [name="company_website"]');
        if (hp && hp.value.trim() !== '') {
          // Silent bot trap
          window.location.href = getBasePath() + 'thankyou/';
          return;
        }

        var nameInput = form.querySelector('[name="name"]');
        var emailInput = form.querySelector('[name="email"]');
        var companyInput = form.querySelector('[name="company"]');
        var codeInput = form.querySelector('[name="country_code"]');
        var phoneInput = form.querySelector('[name="phone"]');
        var serviceInput = form.querySelector('[name="service"], [name="requirement"]');
        var msgInput = form.querySelector('[name="message"]');

        var valid = true;
        var firstBad = null;

        function checkField(input, condition) {
          if (!input) return;
          var field = input.closest('.field');
          if (!condition) {
            valid = false;
            if (field) field.classList.add('has-error');
            if (!firstBad) firstBad = input;
          } else {
            if (field) field.classList.remove('has-error');
          }
        }

        checkField(nameInput, nameInput && nameInput.value.trim().length > 0);
        checkField(emailInput, emailInput && emailInput.value.trim().length > 0 && emailInput.checkValidity());

        var rawPhone = phoneInput ? phoneInput.value.trim() : '';
        var digitsOnly = rawPhone.replace(/\D/g, '');
        checkField(phoneInput, digitsOnly.length >= 7);

        checkField(msgInput, msgInput && msgInput.value.trim().length > 0);

        if (!valid) {
          if (firstBad) firstBad.focus();
          setStatus('err', 'Please complete the highlighted fields with valid details.');
          return;
        }

        var countryCode = codeInput ? codeInput.value : '+91';
        var formattedPhone = countryCode + ' ' + rawPhone;
        var isModal = !!form.closest('#kneoLeadModal');

        var payload = {
          name: nameInput.value.trim(),
          email: emailInput.value.trim(),
          company: companyInput ? companyInput.value.trim() : '',
          phone: formattedPhone,
          service: serviceInput ? serviceInput.value : '',
          message: msgInput.value.trim(),
          source: isModal ? 'KNEO Website WhatsApp Widget' : 'KNEO Website Contact Form',
          page: window.location.href,
          submittedAt: new Date().toISOString()
        };

        if (submit) {
          submit.disabled = true;
          submit.classList.add('is-loading');
          var textSpan = submit.querySelector('.btn__text');
          if (textSpan) { submit.dataset.label = textSpan.textContent; textSpan.textContent = 'Submitting...'; }
        }

        var pabblyReq = fetch(PABBLY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(function (err) {
          console.error('Pabbly submission error:', err);
          return null;
        });

        var crmReq = fetch(CRM_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': CRM_API_KEY
          },
          body: JSON.stringify(payload)
        }).catch(function (err) {
          console.error('CRM submission error:', err);
          return null;
        });

        Promise.allSettled([pabblyReq, crmReq]).then(function (results) {
          var anySuccess = false;
          var anyAttempted = false;

          results.forEach(function (res) {
            if (res.status === 'fulfilled' && res.value !== null) {
              anyAttempted = true;
              if (res.value.ok) anySuccess = true;
            }
          });

          // Push dataLayer generate_lead event
          try {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
              event: 'generate_lead',
              lead_type: isModal ? 'whatsapp_widget' : 'contact_form',
              service_interest: payload.service || 'General'
            });
          } catch (e) {}

          if (anyAttempted && !anySuccess) {
            if (submit) {
              submit.disabled = false;
              submit.classList.remove('is-loading');
              var textSpan = submit.querySelector('.btn__text');
              if (textSpan && submit.dataset.label) textSpan.textContent = submit.dataset.label;
            }
            setStatus('err', 'Submission failed. Please check your connection or contact us directly at sales@kneoautomation.com.');
            return;
          }

          form.reset();
          window.location.href = getBasePath() + 'thankyou/';
        }).catch(function (err) {
          console.error('Submission error:', err);
          if (submit) {
            submit.disabled = false;
            submit.classList.remove('is-loading');
            var textSpan = submit.querySelector('.btn__text');
            if (textSpan && submit.dataset.label) textSpan.textContent = submit.dataset.label;
          }
          setStatus('err', 'Submission failed. Please check your connection or contact us directly at sales@kneoautomation.com.');
        });
      });
    });

    function getBasePath() {
      var body = document.body;
      var path = body ? body.getAttribute('data-path') || '' : '';
      var depth = (path.match(/\//g) || []).length;
      var base = '';
      for (var i = 0; i < depth; i++) base += '../';
      return base || './';
    }
  }

  /* ========================================================================
     14. MISC
     ==================================================================== */

  /* Safety net for the head script's scrollRestoration setting. If a browser
     still had a scroll position queued, land at the top rather than mid-page.
     Anchor links are left alone, so /mapp/#modules still jumps to its section,
     and back/forward is untouched because the head script leaves those on
     'auto'. Smooth scrolling is suspended for the correction so it cannot
     animate a long, ugly scroll on arrival. */
  function initScrollStart() {
    if (!('scrollRestoration' in history)) return;
    if (history.scrollRestoration !== 'manual') return;
    if (window.location.hash) return;
    if ((window.pageYOffset || document.documentElement.scrollTop || 0) === 0) return;

    var root = document.documentElement;
    var previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previous;
  }

  /* ====================================================================
     ROTATING SPOTLIGHT — "What are you trying to solve?"
     --------------------------------------------------------------------
     Ten cards on a ring with one lit position at dead centre. Every two
     seconds the ring turns one place: the next card slides into the
     centre, the one that was there moves out to the side, and card ten is
     followed by card one with no seam.

     The seam is what makes this a ring rather than a row. Each card's slot
     is its distance from the centre wrapped into -5..4, so a card leaving
     at one edge is already the card arriving at the other. It crosses the
     middle of that wrap at opacity 0, where nothing is painted, so the
     jump can never be seen.

     Offsets are derived from the card's measured width rather than fixed
     pixels, so the ring keeps its proportions from 1000px up to the
     widest the container goes, and the outermost pair can never reach
     past the container and push the page sideways.
     ==================================================================== */
  /* ====================================================================
     CERTIFICATE CARD
     --------------------------------------------------------------------
     The About hero shows a scan of the ISO 9001:2015 certificate. If that
     image is ever missing the frame would render as a broken-image icon in
     the middle of the hero, so the whole aside is removed instead and the
     hero falls back to the single-column layout it had before.
     ==================================================================== */
  function initCertCard() {
    var img = document.querySelector('.certcard img');
    if (!img) return;
    var drop = function () {
      var aside = img.closest('.page-hero__aside');
      if (aside) aside.remove();
      var hero = document.querySelector('.page-hero--split');
      if (hero) hero.classList.remove('page-hero--split');
    };
    /* complete + naturalWidth 0 means it already failed before this ran. */
    if (img.complete && !img.naturalWidth) { drop(); return; }
    on(img, 'error', drop);
  }

  function initSolveRing() {
    var ring = $('.solve-ring');
    if (!ring) return;

    var cards = Array.prototype.filter.call(ring.children, function (el) {
      return el.classList && el.classList.contains('card');
    });
    if (cards.length < 3) return;

    var N = cards.length;
    var DWELL = 3000;
    /* The first move comes sooner than the rest. At a flat 3s the strip sat
       motionless for a full dwell after scrolling into view - measured at
       3117ms - which reads as a static row of cards rather than a carousel
       about to turn. The lead only applies to the first advance; the rhythm
       after that is the 3s it is meant to be. */
    var LEAD = 900;
    var startedOnce = false;

    var index = 0, inView = false, held = false;
    var timer = null, quietUntil = 0, resumeTimer = null;
    var wide = window.matchMedia('(min-width: 1000px)');

    /* Slots, as multiples of one card width.

       The neighbours used to tuck BEHIND the centre card, which put their
       top-left corner - where the category sits - underneath it. The cards
       on the right therefore read as blank boxes. They now stand clear of
       the centre card with a gap, so every card on stage shows its own
       words. That costs the outer pair: three cards at full readable size
       is all 1167px holds, so anything past the first neighbour is off.

       Outer edge works out at 1.42 card widths from centre, against a half
       container of 584px at the widest - it can never push the page out. */
    var SLOT = [
      { x: 0,    s: 1,    o: 1, z: 30 },   /* centre    */
      { x: 0.98, s: 0.88, o: 1, z: 20 },   /* beside    */
      { x: 0.98, s: 0.82, o: 0, z: 1  }    /* off stage */
    ];

    /* ---- Artwork ----
       Each card shows a photograph of the problem it names. The filename
       comes from the card's own category, so a card added later needs no
       wiring: drop a matching jpg in and it appears.

       The base path is read off the stylesheet link rather than assumed,
       so this cannot break if the block is ever used on a page that is not
       at the site root.

       Set after load. The artwork is decorative and 483KB across ten
       files; it must not compete with the page arriving. */
    function dress() {
      var link = document.querySelector('link[rel="stylesheet"][href*="main.css"]');
      var base = link ? link.getAttribute('href').replace(/css\/main\.css.*$/, '') : 'assets/';
      cards.forEach(function (card) {
        var tag = card.querySelector('.cell__tag');
        if (!tag) return;
        var slug = tag.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        /* Absolute, deliberately. A url() inside a custom property is
           resolved against the stylesheet that CONSUMES it, not the page -
           and main.css sits in /assets/css/, so a relative path here comes
           out as /assets/css/assets/img/solve/... and 404s silently. */
        var abs = new URL(base + 'img/solve/' + slug + '.jpg', document.baseURI).href;
        card.style.setProperty('--shot', 'url("' + abs + '")');
      });
    }
    if (document.readyState === 'complete') dress();
    else on(window, 'load', dress);

    /* ---- Dots ---- */
    var dots = document.createElement('div');
    dots.className = 'strip-dots';
    var buttons = cards.map(function (card, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'strip-dots__dot';
      var tag = card.querySelector('.cell__tag');
      b.setAttribute('aria-label', tag ? tag.textContent.trim() : String(i + 1));
      on(b, 'click', function () { turnTo(i); hold(6000); });
      dots.appendChild(b);
      return b;
    });
    ring.parentNode.insertBefore(dots, ring.nextSibling);

    /* Strip every trace of the ring. Called whenever the layout is not the
       ring - never rely on a matchMedia change event alone for this, it
       does not fire on every path that can change the layout, and a card
       left holding pointer-events:none is a card nobody can click. */
    function clear() {
      cards.forEach(function (c) {
        c.classList.remove("is-lit");
        c.style.pointerEvents = "";
        c.removeAttribute("tabindex");
        ["--slot-x", "--slot-s", "--slot-o", "--slot-z"].forEach(function (p) {
          c.style.removeProperty(p);
        });
      });
      buttons.forEach(function (b) { b.removeAttribute("aria-current"); });
    }

    function place() {
      if (!wide.matches) { clear(); return; }
      var w = ring.getBoundingClientRect().width ? cards[0].offsetWidth : 0;
      if (!w) return;
      cards.forEach(function (card, i) {
        /* Distance from the lit slot, wrapped onto the ring. */
        var d = ((i - index) % N + N) % N;
        if (d > N / 2) d -= N;
        var slot = SLOT[Math.min(Math.abs(d), 2)];
        var dir = d < 0 ? -1 : 1;
        card.style.setProperty('--slot-x', (dir * slot.x * w).toFixed(1) + 'px');
        card.style.setProperty('--slot-s', slot.s);
        card.style.setProperty('--slot-o', slot.o);
        card.style.setProperty('--slot-z', slot.z);
        card.classList.toggle('is-lit', d === 0);
        /* A card that is not on stage should not be a tab stop or a click
           target - it is invisible, and an invisible link is a trap. */
        var off = Math.abs(d) > 1;
        card.style.pointerEvents = off ? 'none' : '';
        if (off) card.setAttribute('tabindex', '-1');
        else card.removeAttribute('tabindex');
      });
      buttons.forEach(function (b, i) {
        if (i === index) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }

    function turnTo(n) {
      index = ((n % N) + N) % N;
      place();
    }

    function running() {
      return wide.matches && inView && !held && Date.now() >= quietUntil
             && !document.hidden && !prefersReduced();
    }

    function tick() {
      timer = null;
      if (!running()) return;
      startedOnce = true;
      turnTo(index + 1);
      schedule();
    }

    function schedule() {
      /* Idempotent on purpose. This is called from scroll and resize, and
         the old body cleared the pending timer and started a fresh
         full-length one every time - so while the page was being scrolled
         the countdown never finished and nothing advanced. Measured: six
         seconds of scrolling, zero moves. Stop a countdown when the
         component should not be running, but never restart one that is
         already ticking. */
      if (!running()) { if (timer) { window.clearTimeout(timer); timer = null; } return; }
      if (timer) return;
      timer = window.setTimeout(tick, startedOnce ? DWELL : LEAD);
    }

    function hold(ms) {
      quietUntil = Date.now() + (ms || 6000);
      schedule();
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(schedule, (ms || 6000) + 60);
    }

    /* Pointing at the ring holds it where it is. Deliberately the whole
       ring and not a single card: the cards move, so a per-card hover
       would hand the spotlight to whatever slid under a still cursor. */
    on(ring, 'pointerenter', function () { held = true; schedule(); });
    on(ring, 'pointerleave', function () { held = false; schedule(); });
    on(ring, 'focusin', function () { held = true; schedule(); });
    on(ring, 'focusout', function (e) {
      if (ring.contains(e.relatedTarget)) return;
      held = false; schedule();
    });

    on(document, 'visibilitychange', schedule);
    if (reduceMotion.addEventListener) on(reduceMotion, 'change', schedule);
    if (wide.addEventListener) on(wide, "change", function () { place(); schedule(); });

    /* Geometry as well as the observer: IntersectionObserver callbacks are
       deferred while a document is hidden, so a page opened in a
       background tab would come back to a ring that never started. */
    function measure() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var r = ring.getBoundingClientRect();
      var seen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      inView = r.height > 0 && (seen / r.height) > 0.35;
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { inView = e.isIntersecting; });
        schedule();
      }, { threshold: 0.35 });
      io.observe(ring);
    }

    var again = throttle(function () { measure(); place(); schedule(); }, 150);
    on(window, 'scroll', throttle(function () { measure(); schedule(); }, 150), { passive: true });
    on(window, 'resize', again, { passive: true });
    on(window, 'load', function () { measure(); place(); schedule(); });

    place();
    measure();
    schedule();
  }

  /* ====================================================================
     MAPP MODULE ORBIT
     --------------------------------------------------------------------
     Upgrades an existing list of module links into a ring with one module
     lit at a time. It carries no copy of its own: it reads whatever list
     it is wrapped around, so the home page keeps the home page's wording
     and /mapp/ keeps its own, and with JavaScript off the original list
     is still there, still linked and still indexable.

     Two list shapes exist on this site and they label themselves in
     opposite orders, so the reader handles both rather than assuming:

       .cell       .cell__tag = "MAPP EYE",  h3 = "Performance Monitoring"
       .index-row  h3 = "MAPP EYE",  .index-row__tag = "Performance ..."

     Behaviour matches the reference: 3.2s auto-advance, only while on
     screen and the tab is visible, and a click pauses it for 9s.
     ==================================================================== */

  /* ====================================================================
     DELIVERY STEP FLOW
     --------------------------------------------------------------------
     Upgrades an existing .timeline into a row of six filling bars with one
     description shown at a time. It carries no copy: it reads the list it
     is pointed at, so the home page keeps its six steps and
     /industrial-automation/ keeps its own, and with JavaScript off the
     original list is still there, still readable and still indexable.

     Behaviour matches the reference: the sequence only runs while the row
     is on screen and the tab is visible, each bar fills over 3s, finished
     steps go solid, and a click jumps to a step and holds for 9s.
     ==================================================================== */

  /* ====================================================================
     WHAT WE DO - ENGINEERING + PLATFORM PAIR
     --------------------------------------------------------------------
     Upgrades the two card grids already in the section into an accordion
     of disciplines and a grid of module tiles with a live readout line.

     It carries no copy. Everything comes off the markup that is already
     there, so the service descriptions, the module names and every href
     stay exactly as authored, and with JavaScript off the two source
     grids are what renders.

     The .cell__tag on a service is a separator-joined list - "PLC · HMI ·
     SCADA · Robotics" - so it splits into the chips under each discipline
     rather than needing a second, hand-kept list of technologies.
     ==================================================================== */

  /* ====================================================================
     AUTO BALLOONING - HOW IT WORKS
     --------------------------------------------------------------------
     An interactive demo of the product: import a drawing, drag a box
     around the views you want, watch the balloons and the characteristics
     table fill in together.

     Scoped per mount rather than by element id, because the section runs
     on two pages and nothing here may assume it is the only copy on the
     document. Everything is queried inside its own [data-abal].

     The sample drawing and its characteristics are illustrative, and the
     window says so. ax/ay is where a characteristic sits, and is what the
     selection test uses; bx/by is the balloon, lx/ly the leader end. All
     in SVG units of the 800x520 sheet.
     ==================================================================== */

  /* ====================================================================
     INDUSTRIES - EXPANDING STRIP
     --------------------------------------------------------------------
     Turns the .industry-tile grid into one row of panels with a single
     one open. It carries no copy: name, description, icon and href all
     come off the tiles already on the page, so the home page keeps its
     wording and /industries/ keeps its longer version, the URLs cannot
     drift, and with JavaScript off the original grid is what renders.

     The reference also shows a row of tags per industry. Neither page
     has any, and they are not something to invent, so the panel runs
     without them.
     ==================================================================== */
  /* ====================================================================
     PFMEA - VISUALIZE, PRIORITIZE, CONTROL
     --------------------------------------------------------------------
     The AIAG-VDA seven-step analysis as an interactive mind map with two
     action-priority heat maps. Converted from the approved
     07-pfmea.html rather than rewritten, so the behaviour is exactly what
     was signed off.

     Everything is data: the seven steps, the node types and which types
     each may connect to, the sample graph, the failure chains, the
     optimisation actions and the heat-map zone table all live in the
     config block below. The map is re-rendered from that state, never
     read back out of the DOM.

     The sample project is illustrative and the window says so.
     ==================================================================== */
  function initPfmea() {
    /* Inert unless the section is on the page - this ships in one bundle
       served to all 55 pages. */
    if (!document.querySelector('.pv') || !document.getElementById('pv-app')) return;

    /* ======================= CONFIG (edit here) ======================= */
    const STEPS7 = [
      ['Planning & Preparation', '#E4572E'], ['Process Structure Analysis', '#1FB5C4'], ['Function Analysis', '#E8A43A'],
      ['Failure Analysis', '#6AB04C'], ['Risk Analysis', '#1FA38A'], ['Optimization', '#5B4B9E'], ['Results Documentation', '#8E44AD']
    ];
    // Node types, in PFMEA order. next = which types a node of this type may connect to.
    const TYPES = {
      root: { h: 'Line',               label: 'Line',           col: 0, next: ['step'] },
      step: { h: 'Process Step · PFD', label: 'Process step',   col: 1, next: ['we'] },
      we:   { h: 'Work Element · 4M',  label: 'Work element',   col: 2, next: ['fn'] },
      fn:   { h: 'Function',           label: 'Function',       col: 3, next: ['fm'] },
      fm:   { h: 'Failure Mode',       label: 'Failure mode',   col: 4, next: ['fe', 'fc'] },
      fe:   { h: 'Failure Effect',     label: 'Failure effect', col: 5, next: [] },
      fc:   { h: 'Failure Cause',      label: 'Failure cause',  col: 5, next: ['risk'] },
      risk: { h: 'Risk Analysis',      label: 'Risk analysis',  col: 6, next: [] }
    };
    const X = [14, 158, 306, 454, 602, 752, 918];
    const NODE_W = 132, SNAP = 7, ROW = 58;

    // Sample project. yc = vertical centre. phase = when it appears in the demo.
    const INITIAL = {
      nodes: [
        { id: 'root', type: 'root', col: 0, yc: 185, t: 'Bearing housing line', phase: 1 },
        { id: 'sA', type: 'step', col: 1, yc: 70,  t: 'OP 30 Press-fit bearing', phase: 1 },
        { id: 'wA', type: 'we',   col: 2, yc: 70,  t: 'Hydraulic press', phase: 2 },
        { id: 'fA', type: 'fn',   col: 3, yc: 70,  t: 'Seat bearing at 12.0 mm', phase: 3 },
        { id: 'mA', type: 'fm',   col: 4, yc: 70,  t: 'Bearing not fully seated', phase: 4 },
        { id: 'eA', type: 'fe',   col: 5, yc: 38,  t: 'Noise at customer', phase: 4 },
        { id: 'cA', type: 'fc',   col: 5, yc: 102, t: 'Press force drifts low', phase: 4 },
        { id: 'rA', type: 'risk', col: 6, yc: 102, t: '', phase: 5 },
        { id: 'sB', type: 'step', col: 1, yc: 185, t: 'OP 20 Incoming inspection', phase: 1 },
        { id: 'wB', type: 'we',   col: 2, yc: 185, t: 'Bore gauge', phase: 2 },
        { id: 'sC', type: 'step', col: 1, yc: 300, t: 'OP 40 Grease & cap', phase: 1 },
        { id: 'wC', type: 'we',   col: 2, yc: 300, t: 'Grease dispenser', phase: 2 },
        { id: 'fC', type: 'fn',   col: 3, yc: 300, t: 'Apply 4 g grease', phase: 3 },
        { id: 'mC', type: 'fm',   col: 4, yc: 300, t: 'Grease quantity low', phase: 4 },
        { id: 'eC', type: 'fe',   col: 5, yc: 268, t: 'Early bearing wear', phase: 4 },
        { id: 'cC', type: 'fc',   col: 5, yc: 332, t: 'Nozzle partly blocked', phase: 4 },
        { id: 'rC', type: 'risk', col: 6, yc: 332, t: '', phase: 5 }
      ],
      edges: [['root', 'sA'], ['sA', 'wA'], ['wA', 'fA'], ['fA', 'mA'], ['mA', 'eA'], ['mA', 'cA'], ['cA', 'rA'],
              ['root', 'sB'], ['sB', 'wB'],
              ['root', 'sC'], ['sC', 'wC'], ['wC', 'fC'], ['fC', 'mC'], ['mC', 'eC'], ['mC', 'cC'], ['cC', 'rC']],
      chains: { rA: { S: 7, O: 8, picked: [0, 1] }, rC: { S: 6, O: 4, picked: [0, 1] } }
    };
    // Optimisation actions. dO = how much the action lowers occurrence. New risk nodes get the default list.
    const ACTIONS = {
      rA: [ { t: 'Closed-loop press force control', k: 'Prevention', dO: 5 },
            { t: 'Setpoint change lock via MES', k: 'Prevention', dO: 2 },
            { t: 'Press calibration every shift', k: 'Prevention', dO: 1 } ],
      rC: [ { t: 'Nozzle auto-purge before each cycle', k: 'Prevention', dO: 2 },
            { t: 'Filtered grease supply', k: 'Prevention', dO: 1 },
            { t: 'Nozzle replacement in PM plan', k: 'Prevention', dO: 1 } ],
      _default: [ { t: 'Error-proofing (poka-yoke)', k: 'Prevention', dO: 3 },
                  { t: 'Process parameter monitoring', k: 'Prevention', dO: 2 },
                  { t: 'Preventive maintenance plan', k: 'Prevention', dO: 1 } ]
    };
    // Other failure chains of the project, shown on the heat maps only (S, O before, O after)
    const SAMPLE = [
      { S: 9, O: 3, O2: 3 }, { S: 9, O: 9, O2: 3 }, { S: 8, O: 3, O2: 3 }, { S: 8, O: 4, O2: 4 },
      { S: 7, O: 3, O2: 1 }, { S: 7, O: 4, O2: 4 }, { S: 7, O: 6, O2: 1 }, { S: 7, O: 6, O2: 1 }, { S: 7, O: 6, O2: 2 }, { S: 7, O: 6, O2: 1 },
      { S: 7, O: 9, O2: 1 }, { S: 7, O: 9, O2: 2 }, { S: 7, O: 10, O2: 1 }, { S: 5, O: 4, O2: 1 }
    ];
    // Heat-map zones, read from the product screenshot (illustrative — replace with the product's own table)
    function zone(S, O) {
      if (S >= 9) return O === 1 ? 'y' : 'r';
      if (S >= 4) return O === 1 ? 'g' : (O >= 8 ? 'r' : 'y');
      return O >= 8 ? 'y' : 'g';
    }
    /* Relative luminance of a #rrggbb, so ink can be chosen against a fill. */
    function inkOn(hex) {
      const v = hex.replace('#', '');
      const ch = [0, 2, 4].map((i) => {
        const c = parseInt(v.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
      return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.0586) ? '#FFFFFF' : '#10131F';
    }

    const AP = { r: 'H', y: 'M', g: 'L' }, AP_NAME = { H: 'High', M: 'Medium', L: 'Low' };
    const BADGES = [{ n: 2, x: 372, phase: 1 }, { n: 3, x: 520, phase: 3 }, { n: 4, x: 668, phase: 4 }, { n: 5, x: 984, phase: 5 }];

    /* ======================= SETUP ======================= */
    /* Ids are namespaced in the markup, so the helper adds the prefix once
       rather than at 45 call sites. */
    const $ = (id) => document.getElementById('pv-' + id);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const app = $('app'), mm = $('mm'), wires = $('wires'), NS = 'http://www.w3.org/2000/svg';
    const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    let timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    let mode = reduced ? 'try' : 'auto', visible = false, runId = 0;
    let G = null;                 // current graph
    let showAfter = false;        // risk nodes show optimised values
    let revealAll = false;        // all nodes visible (try mode / finished)
    let scale = 1, W = 1080, H = 370;
    let sel = null;               // { kind: 'node', id } | { kind: 'edge', i }
    let hoverId = null, seq = 1;
    let history = [];

    // 7-step rail
    const railEls = STEPS7.map(([name, c], i) => {
      const d = document.createElement('div');
      d.className = 'rstep'; d.style.setProperty('--pv-c', c);
      /* Ink for the numeral once the diamond fills with its step colour.
         White fails 3:1 on the lighter four (cyan 2.5, amber 2.1, green 2.7),
         and the palette is the product's, so the ink moves instead of the
         colour. Picked from the fill's own luminance, so a recoloured step
         stays legible without anyone remembering to check. */
      d.style.setProperty('--pv-on', inkOn(c));
      d.innerHTML = `<div class="dia"><b>${i + 1}</b></div><span>${name}</span>`;
      $('rail').appendChild(d); return d;
    });
    function railTo(active, doneUpTo) {
      railEls.forEach((el, i) => {
        el.classList.toggle('is-on', active.includes(i + 1));
        el.classList.toggle('is-done', i + 1 <= doneUpTo && !active.includes(i + 1));
      });
    }
    function say(phase, msg) {
      $('phase').textContent = phase;
      const m = $('msg'); m.textContent = msg; m.style.animation = 'none'; void m.offsetWidth; m.style.animation = '';
    }

    // Badges (demo only)
    const badgeEls = BADGES.map((b) => {
      const el = document.createElement('div'); el.className = 'pvbadge'; el.textContent = b.n;
      el.style.left = (b.x - 17) + 'px'; el.style.top = '0px'; mm.appendChild(el); return { ...b, el };
    });

    /* ======================= GRAPH MODEL ======================= */
    function load(src) {
      return {
        nodes: src.nodes.map((n) => ({ id: n.id, type: n.type, x: n.x != null ? n.x : X[n.col], y: n.y != null ? n.y : n.yc - 21, t: n.t, phase: n.phase || 0 })),
        edges: src.edges.map((e) => (Array.isArray(e) ? { from: e[0], to: e[1] } : { ...e })),
        chains: Object.fromEntries(Object.entries(src.chains).map(([k, c]) => [k, { S: c.S, O: c.O, picked: new Set(c.picked) }]))
      };
    }
    const snapshot = () => JSON.stringify({
      nodes: G.nodes.map(({ id, type, x, y, t, phase }) => ({ id, type, x, y, t, phase })),
      edges: G.edges, chains: Object.fromEntries(Object.entries(G.chains).map(([k, c]) => [k, { S: c.S, O: c.O, picked: [...c.picked] }]))
    });
    function pushHistory(snap) { history.push(snap || snapshot()); if (history.length > 60) history.shift(); $('tUndo').disabled = false; }
    function undo() {
      if (!history.length) return;
      G = load(JSON.parse(history.pop())); $('tUndo').disabled = !history.length;
      if (sel && sel.kind === 'node' && !node(sel.id)) sel = null;
      if (sel && sel.kind === 'edge' && !G.edges[sel.i]) sel = null;
      render(); say('Undo', 'Last change undone');
    }

    const node = (id) => G.nodes.find((n) => n.id === id);
    const parentOf = (id) => { const e = G.edges.find((q) => q.to === id); return e ? node(e.from) : null; };
    const childrenOf = (id) => G.edges.filter((e) => e.from === id).map((e) => node(e.to)).filter(Boolean);
    const actionsFor = (rid) => ACTIONS[rid] || ACTIONS._default;
    function chainOf(rid) {
      if (!G.chains[rid]) G.chains[rid] = { S: 5, O: 5, picked: new Set() };
      return G.chains[rid];
    }
    function o2(rid) {
      const c = chainOf(rid); let d = 0;
      c.picked.forEach((i) => { const a = actionsFor(rid)[i]; if (a) d += a.dO; });
      return Math.max(1, c.O - d);
    }
    function upTo(n, type) { let p = n; while (p && p.type !== type) p = parentOf(p.id); return p; }
    // Everything connected to a node: its ancestors and all of its descendants
    function related(id) {
      const set = new Set([id]);
      let p = parentOf(id); while (p) { set.add(p.id); p = parentOf(p.id); }
      const stack = [id];
      while (stack.length) childrenOf(stack.pop()).forEach((c) => { if (!set.has(c.id)) { set.add(c.id); stack.push(c.id); } });
      // a failure mode's effects belong to its causes' chains too
      G.nodes.filter((n) => set.has(n.id) && n.type === 'fc').forEach((fc) => {
        const fm = parentOf(fc.id); if (fm) childrenOf(fm.id).filter((c) => c.type === 'fe').forEach((fe) => set.add(fe.id));
      });
      return set;
    }

    /* ======================= RENDER ======================= */
    function riskHTML(n) {
      const c = chainOf(n.id), O2 = o2(n.id), O = showAfter ? O2 : c.O, ap = AP[zone(c.S, O)];
      const oTxt = showAfter && O2 !== c.O ? `O${c.O}→${O2}` : `O${O}`;
      return { html: `<div class="h"><span>Risk Analysis</span><span>AP ${ap}</span></div><div class="t">S${c.S} · ${oTxt} · ${AP_NAME[ap]}</div>`, ap };
    }
    function headFor(n) {
      if (n.type !== 'fe') return TYPES[n.type].h;
      const fm = parentOf(n.id); if (!fm) return 'Failure Effect';
      const risks = childrenOf(fm.id).filter((c) => c.type === 'fc').flatMap((fc) => childrenOf(fc.id)).filter((r) => r.type === 'risk');
      return risks.length ? `Failure Effect · S ${chainOf(risks[0].id).S}` : 'Failure Effect';
    }
    function paintNode(n) {
      if (n.type === 'risk') { const r = riskHTML(n); n.el.querySelector('.body').innerHTML = r.html; n.el.style.setProperty('--pv-c', `var(--pv-n-${r.ap})`); }
      else { n.el.querySelector('.h span').textContent = headFor(n); n.el.querySelector('.t').textContent = n.t; }
    }
    function makeNode(n) {
      const el = document.createElement('div');
      el.className = 'node' + (TYPES[n.type].next.length ? '' : ' leaf') + (revealAll ? ' is-in' : '');
      el.dataset.id = n.id;
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      el.style.setProperty('--pv-c', `var(--pv-n-${n.type})`);
      el.innerHTML = `<div class="body"><div class="h"><span></span><span>⋯</span></div><div class="t"></div></div>` +
        (TYPES[n.type].next.length ? `<span class="port" title="Drag to connect" aria-hidden="true"></span>` : '');
      if (mode === 'try') {
        el.tabIndex = 0; el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${TYPES[n.type].label}: ${n.t || 'risk analysis'}. Press Enter to edit, arrow keys to move, Delete to remove.`);
      }
      n.el = el; paintNode(n);
      return el;
    }
    function render() {
      mm.querySelectorAll('.node').forEach((e) => e.remove());
      G.nodes.forEach((n) => mm.appendChild(makeNode(n)));
      updateSize(); drawWires(); refreshHeat(); paint(); syncTools();
      if (mode === 'try') renderEditor();
    }
    function wirePath(p, n) {
      const x1 = p.x + NODE_W + 2, y1 = p.y + p.el.offsetHeight / 2, x2 = n.x, y2 = n.y + n.el.offsetHeight / 2;
      if (x2 < x1 + 24) { const k = Math.max(60, Math.abs(x2 - x1) / 2); return `M${x1} ${y1} C${x1 + k} ${y1}, ${x2 - k} ${y2}, ${x2} ${y2}`; }
      const mx = x1 + (x2 - x1) / 2, s = Math.sign(y2 - y1), r = Math.min(6, Math.abs(y2 - y1) / 2);
      return y1 === y2 || r < 1 ? `M${x1} ${y1} H${x2}` : `M${x1} ${y1} H${mx - r} Q${mx} ${y1} ${mx} ${y1 + s * r} V${y2 - s * r} Q${mx} ${y2} ${mx + r} ${y2} H${x2}`;
    }
    function drawWires() {
      wires.querySelectorAll('.wire:not(.temp), .wire-hit').forEach((w) => w.remove());
      G.nodes.forEach((n) => { n.wire = null; });
      G.edges.forEach((e, i) => {
        const p = node(e.from), n = node(e.to); if (!p || !n || !p.el || !n.el) return;
        const d = wirePath(p, n);
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('class', 'wire' + ((revealAll || n.el.classList.contains('is-in')) ? ' is-in' : '') + (sel && sel.kind === 'edge' && sel.i === i ? ' sel' : ''));
        path.setAttribute('pathLength', '1'); path.setAttribute('d', d); path.dataset.from = e.from; path.dataset.to = e.to;
        wires.insertBefore(path, wires.firstChild); n.wire = path;
        if (mode === 'try') {
          const hit = document.createElementNS(NS, 'path');
          hit.setAttribute('class', 'wire-hit'); hit.setAttribute('d', d); hit.dataset.i = i; wires.appendChild(hit);
        }
      });
    }
    function updateSize() {
      let mx = 1080, my = 370;
      G.nodes.forEach((n) => { mx = Math.max(mx, n.x + NODE_W + 60); my = Math.max(my, n.y + (n.el ? n.el.offsetHeight : 50) + 40); });
      W = mx; H = my;
      mm.style.width = W + 'px'; mm.style.height = H + 'px';
      wires.setAttribute('viewBox', `0 0 ${W} ${H}`); wires.style.width = W + 'px'; wires.style.height = H + 'px';
      fit();
    }
    function fit() {
      const w = $('mmScroll').clientWidth || 1080;
      /* Capped at 1.0 rather than 1.25. At 1.25 the 370-tall canvas rendered
         462px and the whole section ran past two screens; the map is drawn
         for 1080 and does not need enlarging to read. */
      scale = Math.max(0.62, Math.min(1.0, w / 1080));
      mm.style.transform = `scale(${scale})`;
      $('mmWrap').style.width = (W * scale) + 'px';
      $('mmWrap').style.height = (H * scale) + 'px';
    }
    new ResizeObserver(fit).observe($('mmScroll'));
    /* Belt and braces on the scale. ResizeObserver notifications are delivered
       in the rendering steps, which are throttled while a document is hidden,
       and a stale scale here is not cosmetic - the 1080-wide map would render
       at full size inside a 388px phone container. A plain resize listener
       always fires. */
    on(window, 'resize', throttle(fit, 150), { passive: true });

    // Dim everything not connected to the hovered / selected node
    function paint() {
      const focusId = hoverId || (sel && sel.kind === 'node' ? sel.id : null);
      const set = focusId && node(focusId) ? related(focusId) : null;
      G.nodes.forEach((n) => {
        if (!n.el) return;
        n.el.classList.toggle('dim', !!set && !set.has(n.id) && n.type !== 'root');
        n.el.classList.toggle('hot', !!set && set.has(n.id) && n.type === 'risk' && mode !== 'try');
        n.el.classList.toggle('sel', !!sel && sel.kind === 'node' && sel.id === n.id);
      });
      wires.querySelectorAll('.wire:not(.temp)').forEach((w) => {
        w.classList.toggle('dim', !!set && !(set.has(w.dataset.from) && set.has(w.dataset.to)));
      });
      document.querySelectorAll('.pvdot').forEach((d) => d.classList.toggle('hot', !!set && (d.dataset.ids || '').split(',').some((x) => set.has(x))));
    }

    /* ======================= HEAT MAPS ======================= */
    function buildGrid(gridId, rowsId, colsId, withEmpty) {
      const g = $(gridId);
      for (let S = 10; S >= 1; S--) for (let O = 1; O <= 10; O++) {
        const c = document.createElement('div'); c.className = 'pvcell ' + zone(S, O); c.dataset.k = S + '-' + O; g.appendChild(c);
      }
      const layer = document.createElement('div'); layer.className = 'dotl'; g.appendChild(layer);
      if (withEmpty) { const e = document.createElement('div'); e.className = 'hm-empty'; e.innerHTML = '<span>Fills in after optimization</span>'; g.appendChild(e); g.empty = e; }
      $(rowsId).innerHTML = Array.from({ length: 10 }, (_, i) => `<span>${10 - i}</span>`).join('');
      $(colsId).innerHTML = Array.from({ length: 10 }, (_, i) => `<span>${i + 1}</span>`).join('');
      g.layer = layer; return g;
    }
    const gA = buildGrid('gridA', 'rowsA', 'colsA', false), gB = buildGrid('gridB', 'rowsB', 'colsB', true);
    const pos = (S, O) => ({ left: ((O - 0.5) * 10) + '%', top: ((10 - S + 0.5) * 10) + '%' });
    function allChains() {
      const risks = G.nodes.filter((n) => n.type === 'risk').map((n) => { const c = chainOf(n.id); return { id: n.id, S: c.S, O: c.O, O2: o2(n.id) }; });
      return risks.concat(SAMPLE.map((c) => ({ ...c, id: null })));
    }
    function renderDots(g, key, delayStep, isStatic) {
      g.layer.textContent = '';
      g.querySelectorAll('.pvcell').forEach((c) => c.classList.remove('has'));
      const groups = {};
      allChains().forEach((c) => {
        const O = c[key], k = c.S + '-' + O;
        groups[k] = groups[k] || { S: c.S, O, ids: [], n: 0 };
        groups[k].n++; if (c.id) groups[k].ids.push(c.id);
      });
      Object.values(groups).forEach((grp, i) => {
        const d = document.createElement('div'); d.className = 'pvdot' + (isStatic ? ' static' : ''); d.textContent = grp.n;
        const p = pos(grp.S, grp.O); d.style.left = p.left; d.style.top = p.top; d.dataset.ids = grp.ids.join(',');
        d.style.animationDelay = (reduced ? 0 : delayStep * i) + 'ms';
        d.setAttribute('aria-label', `${grp.n} failure chain${grp.n > 1 ? 's' : ''} at severity ${grp.S}, occurrence ${grp.O}`);
        d.addEventListener('click', () => onDot(grp));
        g.layer.appendChild(d);
        g.querySelector(`[data-k="${grp.S}-${grp.O}"]`).classList.add('has');
      });
    }
    const countAP = (key) => { const t = { H: 0, M: 0, L: 0 }; allChains().forEach((c) => t[AP[zone(c.S, c[key])]]++); return t; };
    const apSummary = (t) => `${t.H} High · ${t.M} Med · ${t.L} Low`;
    function refreshHeat() {
      if (!revealAll) return;
      renderDots(gA, 'O', 0, true); renderDots(gB, 'O2', 0, true); gB.empty.hidden = true;
      $('initCount').textContent = apSummary(countAP('O')); $('afterCount').textContent = apSummary(countAP('O2'));
    }
    function moveDots(done) {
      gB.layer.textContent = ''; gB.empty.hidden = true;
      gB.querySelectorAll('.pvcell').forEach((c) => c.classList.remove('has'));
      const list = allChains();
      const movers = list.map((c, i) => {
        const m = document.createElement('div'); m.className = 'mover';
        const p = pos(c.S, c.O); m.style.left = p.left; m.style.top = p.top; m.style.transitionDelay = (i * 40) + 'ms';
        gB.layer.appendChild(m); return { m, c };
      });
      void gB.layer.offsetWidth;
      movers.forEach(({ m, c }) => { const p = pos(c.S, c.O2); m.style.left = p.left; m.style.top = p.top; });
      later(() => { renderDots(gB, 'O2', 40); done && done(); }, reduced ? 0 : 1200 + list.length * 40);
    }

    /* ======================= WATCH DEMO ======================= */
    function showPhase(p) {
      G.nodes.filter((n) => n.phase === p).forEach((n, i) => {
        const d = reduced ? 0 : i * 140;
        later(() => { if (n.wire) n.wire.classList.add('is-in'); }, d);
        later(() => n.el.classList.add('is-in'), d + (n.wire ? 220 : 0));
      });
      badgeEls.filter((b) => b.phase === p).forEach((b) => later(() => b.el.classList.add('is-in'), reduced ? 0 : 150));
    }
    function resetDemo() {
      clearTimers(); sel = null; hoverId = null;
      G = load(INITIAL); showAfter = false; revealAll = false;
      render();
      badgeEls.forEach((b) => b.el.classList.remove('is-in'));
      [gA, gB].forEach((g) => { g.layer.textContent = ''; g.querySelectorAll('.pvcell').forEach((c) => c.classList.remove('has')); });
      gB.empty.hidden = false; $('toast').hidden = true;
      $('initCount').textContent = ''; $('afterCount').textContent = '';
      railTo([1], 0); say('Step 1', 'Planning & preparation — project scope: Bearing housing line');
    }
    const SCENES = [
      { at: 1500,  run: () => { railTo([2], 1); say('Step 2', 'Process structure — 3 process steps imported directly from the PFD'); showPhase(1); } },
      { at: 3500,  run: () => { say('Step 2', 'Work elements (4M) added under each process step'); showPhase(2); } },
      { at: 5300,  run: () => { railTo([3], 2); say('Step 3', 'Function analysis — what each work element must achieve'); showPhase(3); } },
      { at: 7100,  run: () => { railTo([4], 3); say('Step 4', 'Failure analysis — mode, effect and cause linked in the mind map'); showPhase(4); } },
      { at: 9500,  run: () => { railTo([5], 4); say('Step 5', 'Risk analysis — every failure chain placed on the action-priority heat map'); showPhase(5);
                                renderDots(gA, 'O', 90); $('initCount').textContent = apSummary(countAP('O')); } },
      { at: 12600, run: () => { railTo([6], 5); say('Step 6', 'Optimization — actions lower occurrence; chains move to lower-risk cells');
                                moveDots(() => {
                                  showAfter = true;
                                  G.nodes.filter((n) => n.type === 'risk').forEach((n) => { paintNode(n); n.el.classList.remove('flash'); void n.el.offsetWidth; n.el.classList.add('flash'); });
                                  G.nodes.filter((n) => n.type === 'fe').forEach(paintNode);
                                  $('afterCount').textContent = apSummary(countAP('O2'));
                                }); } },
      { at: 16600, run: () => { railTo([7], 6); say('Step 7', 'Results documentation — preview and export in standard Excel format'); exportDemo(); } },
      { at: 22500, run: () => { if (mode === 'auto' && visible) startDemo(); } }
    ];
    function startDemo() {
      resetDemo();
      const id = ++runId;
      SCENES.forEach((s) => later(() => { if (id === runId && mode === 'auto') s.run(); }, s.at));
    }
    function exportDemo() {
      const b = $('exportBtn');
      b.classList.add('is-pressed', 'is-glow');
      setTimeout(() => b.classList.remove('is-pressed'), 180); setTimeout(() => b.classList.remove('is-glow'), 1400);
      showToast('PFMEA_Bearing-housing.xlsx', 'Exported in standard AIAG-VDA Excel format');
    }
    function showToast(title, sub) {
      const t = $('toast'); t.querySelector('div').innerHTML = `${esc(title)}<small>${esc(sub)}</small>`;
      t.hidden = false; clearTimeout(showToast.t); showToast.t = setTimeout(() => { t.hidden = true; }, 4200);
    }

    /* ======================= TRY IT: EXPORT (real CSV that opens in Excel) ======================= */
    function exportCSV() {
      const rows = [['Process step', 'Work element', 'Function', 'Failure mode', 'Failure effect', 'Severity', 'Failure cause', 'Occurrence', 'Action priority', 'Optimisation actions', 'Occurrence after', 'AP after']];
      G.nodes.filter((n) => n.type === 'risk').forEach((r) => {
        const c = chainOf(r.id), fc = parentOf(r.id), fm = fc && parentOf(fc.id), fn = fm && parentOf(fm.id), we = fn && parentOf(fn.id), st = we && parentOf(we.id);
        const fe = fm ? childrenOf(fm.id).filter((x) => x.type === 'fe').map((x) => x.t).join('; ') : '';
        const acts = [...c.picked].map((i) => (actionsFor(r.id)[i] || {}).t).filter(Boolean).join('; ');
        rows.push([st && st.t, we && we.t, fn && fn.t, fm && fm.t, fe, c.S, fc && fc.t, c.O, AP_NAME[AP[zone(c.S, c.O)]], acts, o2(r.id), AP_NAME[AP[zone(c.S, o2(r.id))]]]
          .map((v) => (v == null ? '' : v)));
      });
      const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = 'PFMEA_sample.csv'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('PFMEA_sample.csv', `${rows.length - 1} failure chain${rows.length === 2 ? '' : 's'} exported · opens in Excel`);
    }
    /* No click handler: the control is a link to the contact page now.
       exportDemo() is still called by the step 7 scene so the watch demo
       keeps its press-and-toast, and exportCSV() is kept because it works
       and is one line from being wired back up. */

    /* ======================= TRY IT: EDITING ======================= */
    function select(s) { sel = s; paint(); drawWires(); syncTools(); renderEditor(); }
    function syncTools() {
      const n = sel && sel.kind === 'node' ? node(sel.id) : null;
      $('tChild').disabled = !n || !TYPES[n.type].next.length;
      $('tDel').disabled = !sel || (n && n.type === 'root');
      $('tUndo').disabled = !history.length;
    }
    $('addType').innerHTML = Object.entries(TYPES).filter(([k]) => k !== 'root').map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

    function freeSpot(x, y) {
      let yy = y, tries = 0;
      while (G.nodes.some((n) => Math.abs(n.x - x) < NODE_W && Math.abs(n.y - yy) < 50) && tries < 40) { yy += ROW; tries++; }
      return Math.round(yy / SNAP) * SNAP;
    }
    function addNode(type, parentId) {
      pushHistory();
      const id = 'n' + (seq++);
      const p = parentId ? node(parentId) : null;
      let x, y;
      if (p) {
        x = p.x + (TYPES[type].col - TYPES[p.type].col || 1) * 148;
        const kids = childrenOf(p.id);
        y = freeSpot(x, kids.length ? Math.max(...kids.map((k) => k.y)) + ROW : p.y);
      } else {
        const sc = $('mmScroll');
        x = Math.round((sc.scrollLeft / scale + 20) / SNAP) * SNAP; y = freeSpot(x, 20);
      }
      const defaults = { step: 'New process step', we: 'New work element', fn: 'New function', fm: 'New failure mode', fe: 'New failure effect', fc: 'New failure cause', risk: '' };
      G.nodes.push({ id, type, x, y, t: defaults[type], phase: 0 });
      if (p) G.edges.push({ from: p.id, to: id });
      if (type === 'risk') chainOf(id);
      sel = { kind: 'node', id };
      render();
      const el = node(id).el; el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      say('Node added', `${TYPES[type].label} added${p ? ` under “${p.t || 'risk'}”` : ' — drag from a parent’s ● to connect it'}`);
    }
    function addChild(parentId, type) {
      const p = node(parentId); if (!p) return;
      const allowed = TYPES[p.type].next; if (!allowed.length) return;
      if (!type) type = p.type === 'fm' && childrenOf(p.id).some((c) => c.type === 'fe') ? 'fc' : allowed[0];
      addNode(type, parentId);
    }
    function deleteNode(id, withBranch) {
      const n = node(id); if (!n || n.type === 'root') { say('Not allowed', 'The line (root) node can’t be deleted'); return; }
      pushHistory();
      const gone = new Set([id]);
      if (withBranch) { const stack = [id]; while (stack.length) childrenOf(stack.pop()).forEach((c) => { gone.add(c.id); stack.push(c.id); }); }
      const orphans = withBranch ? 0 : childrenOf(id).length;
      G.nodes = G.nodes.filter((q) => !gone.has(q.id));
      G.edges = G.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to));
      gone.forEach((g) => { delete G.chains[g]; });
      sel = null; render();
      say('Deleted', withBranch ? `${gone.size} node${gone.size > 1 ? 's' : ''} removed` : (orphans ? `Node removed — ${orphans} child node${orphans > 1 ? 's are' : ' is'} now unconnected` : 'Node removed'));
    }
    function deleteEdge(i) {
      if (!G.edges[i]) return; pushHistory();
      G.edges.splice(i, 1); sel = null; render(); say('Deleted', 'Connection removed');
    }
    function tryConnect(fromId, toId) {
      const a = node(fromId), b = node(toId);
      if (!a || !b || a === b) return false;
      if (!TYPES[a.type].next.includes(b.type)) {
        const ok = TYPES[a.type].next.map((t) => TYPES[t].label.toLowerCase()).join(' or ');
        say('Not allowed', `${TYPES[a.type].label} can connect to ${ok || 'nothing'} — not to ${TYPES[b.type].label.toLowerCase()}`); return false;
      }
      if (G.edges.some((e) => e.from === fromId && e.to === toId)) { say('Already connected', 'These nodes are already linked'); return false; }
      pushHistory();
      const replaced = G.edges.some((e) => e.to === toId);
      G.edges = G.edges.filter((e) => e.to !== toId);
      G.edges.push({ from: fromId, to: toId });
      if (b.type === 'risk') chainOf(b.id);
      render(); say('Connected', `${TYPES[a.type].label} → ${TYPES[b.type].label}${replaced ? ' (previous link replaced)' : ''}`);
      return true;
    }
    function autoLayout() {
      pushHistory();
      let cursor = 36; const done = new Set();
      const order = (list) => list.sort((p, q) => (TYPES[p.type].col - TYPES[q.type].col) || (p.type === 'fe' ? -1 : q.type === 'fe' ? 1 : 0) || p.y - q.y);
      function place(n) {
        done.add(n.id);
        const kids = order(childrenOf(n.id).filter((k) => !done.has(k.id)));
        n.x = X[TYPES[n.type].col];
        if (!kids.length) { n.y = cursor; cursor += ROW; return n.y; }
        const ys = kids.map(place);
        n.y = Math.round((ys[0] + ys[ys.length - 1]) / 2);
        return n.y;
      }
      const roots = order(G.nodes.filter((n) => !parentOf(n.id)));
      const main = roots.filter((n) => n.type === 'root');
      main.concat(roots.filter((n) => n.type !== 'root')).forEach((r) => { if (!done.has(r.id)) { place(r); cursor += 16; } });
      G.nodes.forEach((n) => { n.el.style.transition = 'left .45s cubic-bezier(.2,.7,.2,1), top .45s cubic-bezier(.2,.7,.2,1)'; });
      G.nodes.forEach((n) => { n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px'; });
      const start = performance.now();
      const follow = (now) => { drawWiresLive(); if (now - start < 480) requestAnimationFrame(follow); else render(); };
      requestAnimationFrame(follow);
      say('Auto-layout', 'Nodes arranged into PFMEA columns');
    }
    // While nodes animate, draw wires from their on-screen positions
    function drawWiresLive() {
      const r = mm.getBoundingClientRect();
      G.nodes.forEach((n) => { const b = n.el.getBoundingClientRect(); n._x = (b.left - r.left) / scale; n._y = (b.top - r.top) / scale; });
      wires.querySelectorAll('.wire:not(.temp)').forEach((w) => {
        const p = node(w.dataset.from), n = node(w.dataset.to); if (!p || !n) return;
        w.setAttribute('d', wirePath({ ...p, x: p._x, y: p._y }, { ...n, x: n._x, y: n._y }));
      });
    }
    function resetTry() {
      pushHistory(); G = load(INITIAL); sel = { kind: 'node', id: 'rA' }; render(); say('Reset', 'Sample project restored — use Undo to go back');
    }

    // ---- pointer: drag nodes, drag from ● to connect, click wires ----
    const toCanvas = (e) => { const r = mm.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };
    let drag = null;
    mm.addEventListener('pointerdown', (e) => {
      if (mode !== 'try' || e.button > 0) return;
      const hit = e.target.closest('.wire-hit');
      if (hit) { e.preventDefault(); select({ kind: 'edge', i: +hit.dataset.i }); say('Connection', 'Press Delete (or use the Delete button) to remove this link'); return; }
      const el = e.target.closest('.node');
      if (!el) { if (sel) select(null); return; }
      const n = node(el.dataset.id); if (!n) return;
      if (e.target.closest('[contenteditable="true"]')) return;
      e.preventDefault();
      const p = toCanvas(e);
      if (e.target.closest('.port')) {
        const temp = document.createElementNS(NS, 'path'); temp.setAttribute('class', 'wire temp'); wires.appendChild(temp);
        drag = { kind: 'link', n, temp, id: e.pointerId };
      } else {
        drag = { kind: 'move', n, dx: p.x - n.x, dy: p.y - n.y, sx: n.x, sy: n.y, snap: snapshot(), moved: false, id: e.pointerId };
      }
      // Capture the pointer only for linking now; for moves, only once the node actually moves,
      // so a plain click / double-click still reaches the node.
      if (drag.kind === 'link') mm.setPointerCapture(e.pointerId);
    });
    mm.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = toCanvas(e);
      if (drag.kind === 'move') {
        const nx = Math.max(4, Math.round((p.x - drag.dx) / SNAP) * SNAP), ny = Math.max(4, Math.round((p.y - drag.dy) / SNAP) * SNAP);
        if (!drag.moved && Math.abs(nx - drag.sx) + Math.abs(ny - drag.sy) > 3) {
          drag.moved = true; drag.n.el.classList.add('dragging');
          try { mm.setPointerCapture(e.pointerId); } catch (_) {}
        }
        drag.n.x = nx; drag.n.y = ny; drag.n.el.style.left = nx + 'px'; drag.n.el.style.top = ny + 'px';
        if (drag.moved) drawWires();
      } else {
        const a = drag.n, x1 = a.x + NODE_W + 2, y1 = a.y + a.el.offsetHeight / 2;
        drag.temp.setAttribute('d', `M${x1} ${y1} C${x1 + 60} ${y1}, ${p.x - 60} ${p.y}, ${p.x} ${p.y}`);
        const over = document.elementFromPoint(e.clientX, e.clientY);
        const tgt = over && over.closest('.node');
        G.nodes.forEach((q) => q.el.classList.remove('drop-ok', 'drop-bad'));
        if (tgt && tgt !== a.el) { const b = node(tgt.dataset.id); tgt.classList.add(TYPES[a.type].next.includes(b.type) ? 'drop-ok' : 'drop-bad'); }
      }
    });
    const endDrag = (e, cancel) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (d.kind === 'move') {
        d.n.el.classList.remove('dragging');
        if (d.moved && !cancel) { pushHistory(d.snap); updateSize(); drawWires(); say('Moved', `“${d.n.t || 'Risk analysis'}” repositioned`); }
        if (!d.moved) select({ kind: 'node', id: d.n.id });
      } else {
        d.temp.remove(); G.nodes.forEach((q) => q.el.classList.remove('drop-ok', 'drop-bad'));
        if (!cancel) {
          const over = document.elementFromPoint(e.clientX, e.clientY);
          const tgt = over && over.closest('.node');
          if (tgt) tryConnect(d.n.id, tgt.dataset.id);
          else say('Connect', `Drop on a ${TYPES[d.n.type].next.map((t) => TYPES[t].label.toLowerCase()).join(' or ')} node to link it`);
        }
      }
    };
    mm.addEventListener('pointerup', (e) => endDrag(e, false));
    mm.addEventListener('pointercancel', (e) => endDrag(e, true));
    mm.addEventListener('pointerover', (e) => { const el = e.target.closest('.node'); if (el && !drag) { hoverId = el.dataset.id; paint(); } });
    mm.addEventListener('pointerout', (e) => { if (e.target.closest('.node') && !drag) { hoverId = null; paint(); } });

    // ---- double-click to rename in place ----
    mm.addEventListener('dblclick', (e) => {
      if (mode !== 'try') return;
      const el = e.target.closest('.node'); if (!el) return;
      const n = node(el.dataset.id); if (!n || n.type === 'risk') return;
      const t = el.querySelector('.t'); t.contentEditable = 'true'; t.focus();
      const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      const before = snapshot();
      const finish = (save) => {
        t.removeEventListener('blur', onBlur); t.removeEventListener('keydown', onKey);
        t.contentEditable = 'false';
        const v = t.textContent.trim().slice(0, 48);
        if (save && v && v !== n.t) { pushHistory(before); n.t = v; say('Renamed', `Now “${v}”`); }
        t.textContent = n.t; drawWires(); renderEditor();
      };
      const onBlur = () => finish(true);
      const onKey = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); t.blur(); } if (ev.key === 'Escape') { ev.preventDefault(); finish(false); } ev.stopPropagation(); };
      t.addEventListener('blur', onBlur); t.addEventListener('keydown', onKey);
    });

    // ---- keyboard: Delete, arrows, Enter, Ctrl+Z, Escape ----
    document.addEventListener('keydown', (e) => {
      if (mode !== 'try') return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable) return;
      if (!app.contains(e.target) && e.target !== document.body) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      const el = e.target.closest && e.target.closest('.node');
      if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select({ kind: 'node', id: el.dataset.id }); return; }
      if (!sel) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); sel.kind === 'edge' ? deleteEdge(sel.i) : deleteNode(sel.id, false); return; }
      if (e.key === 'Escape') { select(null); return; }
      if (sel.kind === 'node' && e.key.startsWith('Arrow')) {
        e.preventDefault(); const n = node(sel.id); if (!n) return;
        pushHistory(); const step = e.shiftKey ? SNAP : SNAP * 2;
        if (e.key === 'ArrowLeft') n.x = Math.max(4, n.x - step); if (e.key === 'ArrowRight') n.x += step;
        if (e.key === 'ArrowUp') n.y = Math.max(4, n.y - step); if (e.key === 'ArrowDown') n.y += step;
        n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px'; updateSize(); drawWires();
      }
    });

    // ---- toolbar ----
    $('tAdd').addEventListener('click', () => addNode($('addType').value, null));
    $('tChild').addEventListener('click', () => { if (sel && sel.kind === 'node') addChild(sel.id); });
    $('tDel').addEventListener('click', () => { if (!sel) return; sel.kind === 'edge' ? deleteEdge(sel.i) : deleteNode(sel.id, false); });
    $('tLayout').addEventListener('click', autoLayout);
    $('tUndo').addEventListener('click', undo);
    $('tReset').addEventListener('click', resetTry);

    function onDot(grp) {
      if (mode !== 'try') return;
      if (grp.ids.length) select({ kind: 'node', id: grp.ids[0] });
      else say('Heat map', `${grp.n} other failure chain${grp.n > 1 ? 's' : ''} of this project at S${grp.S} / O${grp.O}`);
    }

    /* ======================= PROPERTIES PANEL ======================= */
    function renderEditor(focusSel) {
      const ed = $('editor');
      if (!sel) {
        ed.innerHTML = `<div class="ed-head"><div><small>Edit the mind map</small><strong>Build it your way</strong></div></div>
          <ul class="ed-help">
            <li><b>Drag</b> a node to move it</li>
            <li><b>Drag from ●</b> to another node to connect</li>
            <li><b>Double-click</b> a node to rename it</li>
            <li><b>Click a link</b>, then Delete to remove it</li>
            <li><b>+ Add node</b> / <b>+ Add child</b> in the toolbar</li>
            <li><b>Risk nodes</b> open the S/O rating and actions</li>
            <li><b>Ctrl + Z</b> undoes, <b>Auto-layout</b> tidies up</li>
          </ul>
          <p class="ed-note">Connections follow the PFMEA order: process step → work element → function → failure mode → effect / cause → risk.</p>`;
        return;
      }
      if (sel.kind === 'edge') {
        const e = G.edges[sel.i]; if (!e) { sel = null; renderEditor(); return; }
        const a = node(e.from), b = node(e.to);
        ed.innerHTML = `<div class="ed-head"><div><small>Connection</small><strong>${esc(TYPES[a.type].label)} → ${esc(TYPES[b.type].label)}</strong></div><button type="button" class="ed-x" id="pv-edClose" aria-label="Close">×</button></div>
          <div class="ed-chain"><div><span>${esc(a.t || 'Risk analysis')}</span></div><div><span aria-hidden="true">↓</span></div><div><span>${esc(b.t || 'Risk analysis')}</span></div></div>
          <div class="ed-row"><button type="button" class="ed-btn danger" id="pv-edDelEdge">Delete connection</button></div>`;
        $('edClose').addEventListener('click', () => select(null));
        $('edDelEdge').addEventListener('click', () => deleteEdge(sel.i));
        return;
      }
      const n = node(sel.id); if (!n) { sel = null; renderEditor(); return; }
      const par = parentOf(n.id);
      const parentOpts = G.nodes.filter((q) => TYPES[q.type].next.includes(n.type) && q.id !== n.id)
        .map((q) => `<option value="${q.id}" ${par && par.id === q.id ? 'selected' : ''}>${esc(q.t || 'Risk analysis')}</option>`).join('');
      const parentField = n.type === 'root' ? '' : `<label class="ed-field">Connected to (parent)
          <select id="pv-edParent"><option value="">— not connected —</option>${parentOpts}</select></label>`;
      const childBtns = TYPES[n.type].next.map((t) => `<button type="button" class="ed-btn" data-add="${t}">+ ${TYPES[t].label}</button>`).join('');
      const delBtns = n.type === 'root' ? '' : `<button type="button" class="ed-btn danger" id="pv-edDel">Delete node</button>${childrenOf(n.id).length ? '<button type="button" class="ed-btn danger" id="pv-edDelBranch">Delete with branch</button>' : ''}`;
      const head = `<div class="ed-head"><div><small class="ed-type"><i style="background:var(--pv-n-${n.type === 'risk' ? AP[zone(chainOf(n.id).S, o2(n.id))] : n.type})"></i>${TYPES[n.type].label}</small><strong>${esc(n.type === 'risk' ? 'Failure chain rating' : n.t)}</strong></div><button type="button" class="ed-x" id="pv-edClose" aria-label="Close">×</button></div>`;

      if (n.type !== 'risk') {
        ed.innerHTML = `${head}
          <label class="ed-field">Text<input id="pv-edText" type="text" maxlength="48" value="${esc(n.t)}"></label>
          ${parentField}
          ${childBtns ? `<p class="ed-sub">Add child</p><div class="ed-row">${childBtns}</div>` : ''}
          ${delBtns ? `<div class="ed-row">${delBtns}</div>` : ''}
          <p class="ed-note">Tip: drag the node to move it, or use the arrow keys.</p>`;
      } else {
        const c = chainOf(n.id), O2 = o2(n.id), apB = AP[zone(c.S, c.O)], apA = AP[zone(c.S, O2)];
        const fc = parentOf(n.id), fm = fc && parentOf(fc.id), fes = fm ? childrenOf(fm.id).filter((x) => x.type === 'fe') : [];
        const st = fc ? upTo(fc, 'step') : null;
        const line = (cls, lab, v) => `<div><span class="pill ${cls}">${lab}</span><span>${v ? esc(v) : '<i style="color:var(--pv-meta)">not connected</i>'}</span></div>`;
        const stepper = (k, label, v) => `<div class="stp"><small>${label}</small><div>
            <button type="button" data-k="${k}" data-d="-1" aria-label="Decrease ${label}" ${v <= 1 ? 'disabled' : ''}>−</button><b>${v}</b>
            <button type="button" data-k="${k}" data-d="1" aria-label="Increase ${label}" ${v >= 10 ? 'disabled' : ''}>+</button></div></div>`;
        ed.innerHTML = `${head}
          <div class="ed-chain">${line('fm', 'FM', fm && fm.t)}${line('fe', 'FE', fes.map((x) => x.t).join('; '))}${line('fc', 'FC', fc && fc.t)}</div>
          ${st ? `<p class="ed-note">Process step: ${esc(st.t)}</p>` : ''}
          <div class="ed-rate">${stepper('S', 'Severity', c.S)}${stepper('O', 'Occurrence', c.O)}</div>
          <div class="ed-ap"><span>Initial<b class="apb ${apB}">${AP_NAME[apB]}</b></span><span aria-hidden="true">→</span><span>After<b class="apb ${apA}">${AP_NAME[apA]}</b></span></div>
          <p class="ed-sub">Optimization actions</p>
          ${actionsFor(n.id).map((a, i) => `<label class="act ${c.picked.has(i) ? 'is-on' : ''}"><input type="checkbox" data-i="${i}" ${c.picked.has(i) ? 'checked' : ''}><span><strong>${esc(a.t)}</strong><small>${a.k} · occurrence −${a.dO}</small></span></label>`).join('')}
          ${parentField}
          ${delBtns ? `<div class="ed-row">${delBtns}</div>` : ''}`;
        ed.querySelectorAll('.stp button').forEach((btn) => btn.addEventListener('click', () => {
          pushHistory(); const k = btn.dataset.k, d = +btn.dataset.d; c[k] = Math.max(1, Math.min(10, c[k] + d));
          afterRiskChange(`.stp button[data-k="${k}"][data-d="${d}"]`);
        }));
        ed.querySelectorAll('.act input').forEach((cb) => cb.addEventListener('change', () => {
          pushHistory(); const i = +cb.dataset.i; cb.checked ? c.picked.add(i) : c.picked.delete(i);
          afterRiskChange(`.act input[data-i="${i}"]`);
        }));
      }
      $('edClose').addEventListener('click', () => select(null));
      const txt = $('edText');
      if (txt) {
        let before = null;
        txt.addEventListener('focus', () => { before = snapshot(); });
        txt.addEventListener('input', () => { n.t = txt.value; paintNode(n); drawWires(); });
        txt.addEventListener('change', () => { if (before && JSON.parse(before).nodes.find((q) => q.id === n.id).t !== n.t) pushHistory(before); before = snapshot(); });
      }
      const ps = $('edParent');
      if (ps) ps.addEventListener('change', () => {
        if (!ps.value) { pushHistory(); G.edges = G.edges.filter((e) => e.to !== n.id); render(); say('Disconnected', 'Node is no longer linked to a parent'); }
        else tryConnect(ps.value, n.id);
      });
      ed.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addChild(n.id, b.dataset.add)));
      if ($('edDel')) $('edDel').addEventListener('click', () => deleteNode(n.id, false));
      if ($('edDelBranch')) $('edDelBranch').addEventListener('click', () => deleteNode(n.id, true));
      if (focusSel) { const f = ed.querySelector(focusSel); if (f && !f.disabled) f.focus(); }
    }
    function afterRiskChange(focusSel) {
      G.nodes.filter((q) => q.type === 'risk' || q.type === 'fe').forEach(paintNode);
      refreshHeat(); paint(); renderEditor(focusSel);
    }

    /* ======================= MODES ======================= */
    function enterTry(fresh) {
      clearTimers(); runId++;
      if (fresh || !G) G = load(INITIAL);
      showAfter = true; revealAll = true; history = [];
      badgeEls.forEach((b) => b.el.classList.remove('is-in'));
      $('toast').hidden = true;
      sel = sel && sel.kind === 'node' && node(sel.id) ? sel : { kind: 'node', id: 'rA' };
      render();
      railTo([2, 3, 4, 5, 6], 7);
      say('Try it', 'Drag nodes, drag from ● to connect, double-click to rename — every change updates the heat maps');
    }
    function setMode(m) {
      mode = m;
      $('modeAuto').setAttribute('aria-pressed', String(m === 'auto'));
      $('modeTry').setAttribute('aria-pressed', String(m === 'try'));
      app.classList.toggle('is-try', m === 'try');
      $('editor').hidden = m !== 'try'; $('tools').hidden = m !== 'try';
      $('modesHint').textContent = m === 'try'
        ? 'Your turn — build and edit the PFMEA mind map as you need it.'
        : 'Watching the demo — click anywhere in the analysis to take over.';
      if (m === 'try') enterTry(true);
      else { sel = null; if (visible) startDemo(); else resetDemo(); }
    }
    $('modeAuto').addEventListener('click', () => setMode('auto'));
    $('modeTry').addEventListener('click', () => { if (mode !== 'try') setMode('try'); });

    // A real click inside the analysis while the demo plays hands control to the visitor
    app.addEventListener('pointerdown', (e) => {
      if (mode !== 'auto' || !e.isTrusted || e.target.closest('.bar')) return;
      setMode('try');
    }, true);

    new IntersectionObserver(([e]) => {
      const was = visible; visible = e.isIntersecting;
      if (mode !== 'auto') return;
      if (visible && !was) startDemo();
      if (!visible && was) { clearTimers(); runId++; }
    }, { threshold: 0.25 }).observe(app);

    if (mode === 'try') setMode('try'); else resetDemo();

    /* Geometry as well as the observer. IntersectionObserver callbacks are
       deferred while a document is hidden, so a page opened in a background
       tab came back to a demo that had never started - the same fallback the
       other auto-running components on this site carry. */
    function measureVisible() {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const r = app.getBoundingClientRect();
      const seen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      const now = r.height > 0 && (seen / r.height) > 0.25;
      if (now === visible) return;
      const was = visible; visible = now;
      if (mode !== 'auto') return;
      if (visible && !was) startDemo();
      if (!visible && was) { clearTimers(); runId++; }
    }
    const sweepVisible = throttle(measureVisible, 150);
    on(window, 'scroll', sweepVisible, { passive: true });
    on(window, 'resize', sweepVisible, { passive: true });
    measureVisible();
  }

  function initIndustryStrip() {
    var mounts = $$('[data-industries]');
    if (!mounts.length) return;

    var HOVER_MS = 140;    /* hover held this long before a panel opens */
    var CYCLE_MS = 2000;   /* autoplay: one industry at a time */
    /* The first move leads, as on the solve carousel. At a flat 2s the strip
       held Automotive open for a full cycle after scrolling in, so it read as
       a fixed panel rather than one of six that rotate. 700ms keeps the same
       proportion of the cycle that 900ms does of that component's 3s. */
    var LEAD_MS = 700;

    mounts.forEach(function (grid) { build(grid); });

    function build(grid) {
      var tiles = $$('.industry-tile', grid);
      if (tiles.length !== 6) return;   /* the strip is six-wide */

      var data = tiles.map(function (t) {
        var h = t.querySelector('h3'), p = t.querySelector('p');
        var ic = t.querySelector('.industry-tile__icon svg');
        return {
          name: h ? h.textContent.trim() : '',
          desc: p ? p.textContent.trim() : '',
          href: t.getAttribute('href') || '',
          icon: ic
        };
      });
      if (data.some(function (d) { return !d.name || !d.href; })) return;

      var strip = document.createElement('ul');
      strip.className = 'indstrip';

      var active = 0, hoverTimer = null, autoTimer = null;
      var inView = false, paused = false, tookOver = false, startedOnce = false;
      var canHover = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)');
      var uid = 'ind-' + Math.random().toString(36).slice(2, 8);

      function svgFrom(src, cls) {
        var span = document.createElement('span');
        span.className = cls;
        span.setAttribute('aria-hidden', 'true');
        if (src) span.appendChild(src.cloneNode(true));
        return span;
      }

      var panels = data.map(function (d, i) {
        var li = document.createElement('li');
        li.className = 'indstrip__panel';
        var bodyId = uid + '-body-' + i;
        var num = ('0' + (i + 1)).slice(-2);

        var face = document.createElement('button');
        face.type = 'button';
        face.className = 'indstrip__face';
        face.setAttribute('aria-expanded', 'false');
        face.setAttribute('aria-controls', bodyId);
        var fn = document.createElement('span'); fn.className = 'indstrip__n'; fn.textContent = num;
        var nm = document.createElement('span'); nm.className = 'indstrip__name'; nm.textContent = d.name;
        face.appendChild(fn); face.appendChild(nm);
        face.appendChild(svgFrom(d.icon, 'indstrip__icon'));

        var body = document.createElement('div');
        body.className = 'indstrip__body';
        body.id = bodyId;

        var top = document.createElement('div'); top.className = 'indstrip__top';
        top.appendChild(svgFrom(d.icon, 'indstrip__badge'));
        var big = document.createElement('span'); big.className = 'indstrip__big';
        big.setAttribute('aria-hidden', 'true'); big.textContent = num;
        top.appendChild(big);

        var h3 = document.createElement('h3'); h3.textContent = d.name;
        var p = document.createElement('p'); p.textContent = d.desc;

        var go = document.createElement('a');
        go.className = 'btn btn--ghost indstrip__go'; go.href = d.href;
        go.textContent = 'Explore ' + d.name + ' ';
        go.insertAdjacentHTML('beforeend',
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
          '<path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" ' +
          'stroke-linecap="round" stroke-linejoin="round"/></svg>');

        var ring = document.createElement('span');
        ring.className = 'indstrip__ring'; ring.setAttribute('aria-hidden', 'true');

        body.appendChild(top); body.appendChild(h3); body.appendChild(p);
        body.appendChild(go); body.appendChild(ring);
        li.appendChild(face); li.appendChild(body);

        on(face, 'click', function () { takeOver(); open(i, true); });
        on(li, 'mouseenter', function () {
          if (!canHover.matches) return;
          pause();
          window.clearTimeout(hoverTimer);
          hoverTimer = window.setTimeout(function () { open(i, false); }, HOVER_MS);
        });
        on(li, 'mouseleave', function () { window.clearTimeout(hoverTimer); resume(); });
        on(li, 'focusin', function () { pause(); });
        on(li, 'focusout', function () { resume(); });

        strip.appendChild(li);
        return li;
      });

      function render() {
        panels.forEach(function (p, j) {
          var isOpen = (j === active);
          p.classList.toggle('is-open', isOpen);
          p.querySelector('.indstrip__face').setAttribute('aria-expanded', String(isOpen));
          p.querySelector('.indstrip__body').setAttribute('aria-hidden', String(!isOpen));
          /* A link inside a collapsed panel is not reachable, so it must not
             be a tab stop either. */
          p.querySelector('.indstrip__go').tabIndex = isOpen ? 0 : -1;
        });
      }

      function open(i, fromUser) {
        if (i === active && !fromUser) return;
        active = i;
        render();
        /* Opened from the keyboard: move on to the link, which is the only
           thing in the panel worth reaching next. */
        if (fromUser && document.activeElement &&
            document.activeElement.classList.contains('indstrip__face')) {
          panels[i].querySelector('.indstrip__go').focus({ preventScroll: true });
        }
      }

      /* ---- Autoplay: one industry every 2s ---- */
      function running() {
        return inView && !paused && !tookOver && !document.hidden && !prefersReduced();
      }
      function schedule() {
        /* Idempotent on purpose. This is called from scroll and resize, and
           the old body cleared the pending timer and started a fresh
           full-length one every time - so while the page was being scrolled
           the countdown never finished and nothing advanced. Measured: six
           seconds of scrolling, zero moves. Stop a countdown when the
           component should not be running, but never restart one that is
           already ticking. */
        if (!running()) { if (autoTimer) { window.clearTimeout(autoTimer); autoTimer = null; } return; }
        if (autoTimer) return;
        /* Only the first advance of a visit leads; coming back to the section
           mid-run picks up at the full cycle rather than jumping. */
        autoTimer = window.setTimeout(tick, startedOnce ? CYCLE_MS : LEAD_MS);
      }
      function tick() {
        autoTimer = null;
        if (!running()) return;
        startedOnce = true;
        active = (active + 1) % panels.length;
        render();
        schedule();
      }
      function pause()  { paused = true; schedule(); }
      function resume() { paused = false; schedule(); }
      /* A real click is the visitor taking the wheel; autoplay stops for good
         rather than dragging them off the panel they just chose. */
      function takeOver() { tookOver = true; schedule(); }

      grid.parentNode.insertBefore(strip, grid);
      grid.setAttribute('data-industries-ready', '');
      render();

      /* Geometry as well as the observer: IntersectionObserver callbacks are
         deferred while a document is hidden, so a page opened in a background
         tab would come back to a strip that never started. */
      function measure() {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var r = strip.getBoundingClientRect();
        var seen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        inView = r.height > 0 && (seen / r.height) > 0.25;
      }
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { inView = e.isIntersecting; });
          schedule();
        }, { threshold: 0.25 }).observe(strip);
      }
      var again = throttle(function () { measure(); schedule(); }, 150);
      on(window, 'scroll', again, { passive: true });
      on(window, 'resize', again, { passive: true });
      on(document, 'visibilitychange', schedule);
      if (reduceMotion.addEventListener) on(reduceMotion, 'change', schedule);
      measure();
      schedule();
    }
  }
  /* ====================================================================
     THE SAME QUALITY WORK, DONE ONCE
     --------------------------------------------------------------------
     Eight quality tasks, each shown as it behaves when the documents stand
     alone and as MAPP ZEN handles it. All the wording lives in ROWS below,
     so a change is one edit here rather than eight in markup.
     ==================================================================== */
  function initZenDoneOnce() {
    var mounts = $$('[data-zdo]');
    if (!mounts.length) return;

    /* ---- content: edit here ---- */
    var ROWS = [
      { topic: 'Characteristics',
        a: 'Ballooned by hand, then re-typed into the PFD, the PFMEA, the control plan and the inspection sheet.',
        b: 'Read off the drawing once and reused by every document that needs them.',
        tag: 'Auto Ballooning' },
      { topic: 'Drawing revisions',
        a: 'Every document has to be found and re-keyed. Usually some of them are missed.',
        b: 'A revision flows through the linked documents, with a record of what changed.' },
      { topic: 'PFMEA',
        a: 'Hundreds of spreadsheet rows that are hard to review and harder to keep current.',
        b: 'Risk shown as a mind map, so failure chains can actually be read and discussed.',
        tag: 'AIAG-VDA' },
      { topic: 'Control plans',
        a: 'A separate file that slowly drifts away from the PFMEA it came from.',
        b: 'Generated from the process risks and kept in step with them.' },
      { topic: 'Inspection',
        a: 'Paper sheets filled in at the station and typed into a system hours later.',
        b: 'Recorded digitally at the point of inspection, against the same characteristic.' },
      { topic: 'SPC',
        a: 'Charts built after the batch is finished — too late to change anything.',
        b: 'Live control charts and limits while the process is still running.' },
      { topic: 'Vision inspection',
        a: 'A separate system with its own database that nobody reconciles.',
        b: 'Defect results land in the same quality record as the manual checks.',
        tag: 'MAPP Vision' },
      { topic: 'Audit preparation',
        a: 'A project — chasing files, versions and signatures across departments.',
        b: 'A report — version history and audit trail already sit on every document.' }
    ];

    var STAGGER = 60;   /* ms between rows */
    var NSS = 'http://www.w3.org/2000/svg';

    function tick() {
      var s = document.createElementNS(NSS, 'svg');
      s.setAttribute('width', '9'); s.setAttribute('height', '9');
      s.setAttribute('viewBox', '0 0 12 12'); s.setAttribute('fill', 'none');
      var p = document.createElementNS(NSS, 'path');
      p.setAttribute('d', 'M2 6.3l2.4 2.4L10 3');
      p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2');
      p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
      s.appendChild(p);
      var w = document.createElement('span');
      w.className = 'zdo__tick'; w.setAttribute('aria-hidden', 'true');
      w.appendChild(s);
      return w;
    }

    mounts.forEach(function (tbl) {
      if (tbl.hasAttribute('data-zdo-ready')) return;
      var section = tbl.closest('.zdo');

      ROWS.forEach(function (r, i) {
        var row = document.createElement('div');
        row.className = 'zdo__r';

        var topic = document.createElement('div');
        topic.className = 'zdo__topic zdo__body';
        topic.style.transitionDelay = (i * STAGGER) + 'ms';
        topic.textContent = r.topic;

        var a = document.createElement('div');
        a.className = 'zdo__a';
        var aIn = document.createElement('span');
        aIn.className = 'zdo__body';
        aIn.style.transitionDelay = (i * STAGGER + 30) + 'ms';
        var x = document.createElement('span');
        x.className = 'zdo__x'; x.setAttribute('aria-hidden', 'true');
        x.textContent = '−';
        aIn.appendChild(x);
        aIn.appendChild(document.createTextNode(r.a));
        a.appendChild(aIn);

        var b = document.createElement('div');
        b.className = 'zdo__b';
        var bIn = document.createElement('span');
        bIn.className = 'zdo__body';
        bIn.style.transitionDelay = (i * STAGGER + 60) + 'ms';
        bIn.appendChild(tick());
        bIn.appendChild(document.createTextNode(r.b));
        if (r.tag) {
          var t = document.createElement('span');
          t.className = 'zdo__tag'; t.textContent = r.tag;
          bIn.appendChild(t);
        }
        b.appendChild(bIn);

        row.appendChild(topic); row.appendChild(a); row.appendChild(b);
        tbl.appendChild(row);
      });

      tbl.setAttribute('data-zdo-ready', '');

      /* Reveal once, when the table comes into view. Nothing repeats and
         nothing runs after, so the section costs nothing at rest. */
      if (!section) return;
      if (prefersReduced() || !('IntersectionObserver' in window)) {
        section.classList.add('is-in');
        return;
      }
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          section.classList.add('is-in');
          obs.disconnect();
        });
      }, { threshold: 0.15 }).observe(tbl);
    });
  }

  function initAutoBalloon() {
    var mounts = $$('[data-abal]');
    if (!mounts.length) return;

    var CHARS = [
      { name: 'Overall length', nom: '120.00', tol: '±0.10', ax: 250, ay: 106, bx: 312, by: 96,  lx: 296, ly: 99 },
      { name: 'Height',         nom: '60.00',  tol: '±0.10', ax: 72,  ay: 210, bx: 62,  by: 150, lx: 66,  ly: 168 },
      { name: 'Bore diameter',  nom: 'Ø24.00', tol: 'H7',    ax: 250, ay: 158, bx: 320, by: 146, lx: 302, ly: 152 },
      { name: 'Slot width',     nom: '40.00',  tol: '±0.05', ax: 315, ay: 316, bx: 378, by: 322, lx: 358, ly: 322 },
      { name: 'Surface finish', nom: 'Ra 1.6', tol: '—',     ax: 150, ay: 312, bx: 212, by: 298, lx: 194, ly: 299 },
      { name: 'Thickness',      nom: '12.00',  tol: '±0.05', ax: 485, ay: 106, bx: 546, by: 96,  lx: 528, ly: 99 },
      { name: 'Flatness',       nom: '0.02',   tol: '—',     ax: 566, ay: 180, bx: 624, by: 180, lx: 602, ly: 180 },
      /* The two notes. Auto capture covers the views only - the panel copy
         already says notes and the title block are left alone - so these are
         what Manual map is for. Both values are printed on the sample sheet
         as it stands; no new sample content is introduced here. */
      { name: 'Remove all burrs',  nom: 'Visual', tol: 'Note 1', ax: 105, ay: 452, bx: 215, by: 448, lx: 200, ly: 452 },
      { name: 'General tolerance', nom: '±0.2',   tol: 'Note 2', ax: 105, ay: 468, bx: 215, by: 477, lx: 202, ly: 471 }
    ];
    var PRESETS = {
      front: { x: 44,  y: 80, w: 372, h: 262, label: 'Front view' },
      side:  { x: 432, y: 80, w: 212, h: 262, label: 'Side view' }
    };
    /* The notes block, which auto capture leaves alone. The autoplay boxes it
       to show what Manual map is for. */
    var NOTES_BOX = { x: 34, y: 438, w: 200, h: 46 };
    var WHOLE_SHEET_LABEL = 'Whole sheet';
    /* How far short of the value a leader stops. It used to be shortened by a
       whole balloon radius, which left the line ending in clear space beside
       the dimension instead of touching it - the leader pointed in the right
       direction but never arrived. Two units just clears the digits. */
    var LEADER_GAP = 2;
    var SHEET = { x: 24, y: 24, w: 752, h: 472 };
    var MIN_AREA   = 16;    /* smallest drag that counts, in SVG units */
    var BALLOON_MS = 420;
    var SCAN_MS    = 1100;
    var NS = 'http://www.w3.org/2000/svg';

    var EXPORT_MSG = 'Demo: the product exports this table as an Excel inspection sheet.';
    var PLAN_MSG   = 'Demo: the product sends these characteristics straight into the inspection plan.';
    var PEN_ON_MSG = 'Pen on — draw around one view to select just that view.';
    var MANUAL_HIDDEN_MSG = 'Manual map on — everything still showing on the drawing is uncaptured. Box one.';
    var MANUAL_MAX     = 6;
    var MANUAL_ON_MSG   = 'Manual map on — drag a box around a value the scan did not take.';

    /* ==================================================================
       READING A REAL DRAWING
       ------------------------------------------------------------------
       A CAD-exported PDF carries its dimension text as real text objects
       with real coordinates, so the page can be ballooned without any OCR.
       PDF.js is vendored under assets/vendor/pdf/ and pulled in only when a
       visitor actually picks a file - it costs nothing on page load - and
       everything runs locally. The file is never posted anywhere.

       A scanned sheet has no text layer. That is not a failure to hide:
       the panel says so and Manual map covers it.
       ================================================================== */
    var PDF_BASE = (function () {
      /* main.js is served from /assets/js/, so the vendor folder sits beside
         it. Reading the path off the script tag keeps this right whatever
         directory depth the page is served from. */
      var s = document.querySelector('script[src*="assets/js/main"]');
      var src = s ? s.getAttribute('src') : '';
      return src.replace(/assets\/js\/main[^/]*$/, 'assets/vendor/pdf/') || '/assets/vendor/pdf/';
    })();
    var pdfLibPromise = null;
    function loadPdfLib() {
      if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
      if (pdfLibPromise) return pdfLibPromise;
      pdfLibPromise = new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = PDF_BASE + 'pdf.min.js';
        s.onload = function () {
          if (!window.pdfjsLib) { rej(new Error('pdf lib missing')); return; }
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_BASE + 'pdf.worker.min.js';
          res(window.pdfjsLib);
        };
        s.onerror = function () { pdfLibPromise = null; rej(new Error('pdf lib failed')); };
        document.head.appendChild(s);
      });
      return pdfLibPromise;
    }

    /* ---- What counts as a characteristic ----
       Ordered: the first rule that matches names the type. These are the
       forms that actually appear on a drawing. Anything else is left for
       Manual map rather than guessed at, because a wrong balloon on a real
       customer drawing is worse than a missing one. */
    /* A number on a drawing. Inch sheets almost always drop the leading zero
       - ".220", not "0.220" - and on a real E-size inch drawing that form was
       102 of the values on the page, so it has to be first class. */
    var NUM = '\\d*\\.\\d+|\\d+';
    function rx(body, flags) { return new RegExp(body.replace(/#/g, NUM), flags); }
    var DIM_RULES = [
      /* Imperial thread callout: .750-16 UNF-2B */
      { re: rx('^(#)\\s*-\\s*\\d+\\s*(UNC|UNEF|UNF|UNJ|UN|NPTF|NPSF|NPT)\\b', 'i'), name: 'Thread' },
      { re: /^[⌀ØΦ]\s*\d*\.?\d+/,                 name: 'Diameter' },
      { re: rx('^S?R\\s*(#)$', 'i'),                             name: 'Radius' },
      { re: rx('^M\\s*(#)\\s*[x\\u00D7X]\\s*(#)'),               name: 'Thread' },
      { re: /^M\s*\d+(\.\d+)?$/,                                 name: 'Thread' },
      { re: rx('^R[azyt]\\s*(#)', 'i'),                          name: 'Surface finish' },
      { re: rx('(#)\\s*(\\u00B0|deg\\b)', 'i'),                  name: 'Angle' },
      { re: rx('^\\d+\\s*[x\\u00D7X]\\s*[\\u2300\\u00D8]\\s*(#)'), name: 'Hole pattern' },
      /* A feature control frame reads as a tolerance then its datums:
         ".030 A B", ".0007 D", ".006 L H-J". A datum can be compound, so
         "H-J" is one datum and not two. Must beat the plain-number rule. */
      { re: rx('^(#)\\s+[A-Z](-[A-Z])?(\\s+[A-Z](-[A-Z])?){0,2}$'), name: 'Geometric tolerance' },
      /* Depth and drill qualifiers: ".40 MIN FULL THRD", ".800 MAX DRILL". */
      { re: rx('^(#)\\s+(MIN|MAX)\\b', 'i'),                     name: 'Dimension' },
      /* A stacked max/min pair, joined by the vertical merge below. */
      { re: rx('^(#)\\s*/\\s*(#)$'),                             name: 'Dimension (limits)' },
      { re: rx('^(#)\\s*[\\u00B1+\\-]'),                         name: 'Dimension' },
      { re: /^\d*\.\d+$/,                                        name: 'Dimension' }
    ];
    /* Title block, revision table and sheet metadata. These sit on every
       drawing and none of them is a characteristic. */
    var DIM_REJECT = [
      /^(dwg|drg|drawing|part|rev|sht|sheet|scale|units?|date|by|chk|appd|appr|mat|material|finish|title|size|weight|qty|proj|projection|note|notes)\b/i,
      /^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/,          /* a date */
      /^\d+\s*[:\/]\s*\d+$/,                             /* a scale, 1:2 */
      /^\d+\s*(of|\/)\s*\d+$/i,                          /* sheet 1 of 2 */
      /^[A-Z]{1,3}[-_ ]?\d{3,}/,                         /* a drawing number */
      /^(mm|cm|inch|in|iso|asme|ansi|din|jis)\b/i
    ];
    function classify(str) {
      var s = String(str).replace(/\s+/g, ' ').trim();
      if (s.length < 2 || s.length > 32) return null;
      if (!/\d/.test(s)) return null;
      /* A bare "4X" is a quantity, not a characteristic; when it prefixes one
         it is kept as part of the name instead. */
      if (/^\d+\s*X$/i.test(s)) return null;
      var qty = '';
      /* The count sits in front on most callouts and behind on a feature
         control frame - ".006 L H-J 2X" - so both ends are checked. */
      var qm = s.match(/^(\d+\s*X)\s+(.+)$/i);
      if (qm) { qty = qm[1].replace(/\s+/g, '') + ' '; s = qm[2]; }
      else {
        var qt = s.match(/^(.+?)\s+(\d+\s*X)$/i);
        if (qt) { qty = qt[2].replace(/\s+/g, '') + ' '; s = qt[1]; }
      }
      for (var r = 0; r < DIM_REJECT.length; r++) if (DIM_REJECT[r].test(s)) return null;
      /* A value in brackets is a reference dimension. It is carried as its own
         type rather than a plain one, because an inspector does not gauge it.
         The opening bracket is often a separate run: the diameter symbol next
         to it is drawn as geometry rather than text, so it leaves a gap wide
         enough to break the merge and ".6125)" arrives on its own. */
      if (/[()]/.test(s)) {
        var inner = s.replace(/[()]/g, '').trim();
        if (new RegExp('^(?:' + NUM + ')$').test(inner)) {
          return { name: qty + 'Reference', nom: '(' + inner + ')', tol: 'Ref' };
        }
      }
      for (var i = 0; i < DIM_RULES.length; i++) {
        if (!DIM_RULES[i].re.test(s)) continue;
        var name = DIM_RULES[i].name;
        if (name === 'Dimension (limits)') {
          return { name: qty ? qty + 'Dimension' : 'Dimension', nom: s, tol: 'Limits' };
        }
        if (name === 'Geometric tolerance') {
          var g = s.match(/^(\S+)\s+(.+)$/);
          return { name: qty + name, nom: g[1], tol: 'Datum ' + g[2] };
        }
        var mm = s.match(/^(\S+)\s+((?:MIN|MAX)\b.*)$/i);
        if (mm) return { name: qty + name, nom: mm[1], tol: mm[2].toUpperCase() };
        /* Split "120.00 ±0.10" so the table and the export carry the nominal
           and the tolerance in their own columns. */
        var m = s.match(/^(.*?)(\s*(?:±\s*[\d.]+|[+\-][\d.]+\s*\/\s*[+\-][\d.]+|\s[A-Za-z]\d+))$/);
        return { name: qty + name,
                 nom: (m ? m[1].trim() : s) || s,
                 tol: m ? m[2].trim() : '—' };
      }
      return null;
    }

    mounts.forEach(function (mount) { build(mount); });

    function build(mount) {
      function q(sel) { return mount.querySelector(sel); }
      var app    = q('.abal__app');
      var svg    = q('.abal__svg');
      var sheet  = q('.abal__sheet');
      var drop   = q('.abal__drop');
      var maskL  = q('.abal__mask-layer');
      var areasL = q('.abal__areas-layer');
      var marq   = q('.abal__marquee');
      var scanL  = q('.abal__scan-layer');
      var blnL   = q('.abal__bln-layer');
      var stepEl = q('.abal__steps');
      var cursor = q('.abal__cursor');
      if (!app || !svg || !sheet || !drop || !areasL || !marq || !scanL || !blnL || !stepEl) return;

      var steps = $$('li', stepEl);
      var panes = [q('.abal__pane--1'), q('.abal__pane--2'), q('.abal__pane--res')];
      if (steps.length !== 4 || panes.some(function (p) { return !p; })) return;

      var reduced = prefersReduced();
      var state = { step: 1, importing: false, areas: [], results: [], nextId: 1,
                    mapHidden: false, manual: false, tool: 'box' };
      var timers = [], rafs = [];

      function later(fn, ms) { var t = window.setTimeout(fn, ms); timers.push(t); return t; }
      function frame(fn) { var r = window.requestAnimationFrame(fn); rafs.push(r); return r; }
      /* Progress is driven by a TIMER, not requestAnimationFrame. rAF is
         suspended while a document is hidden, so a visitor who starts the
         import and switches tabs came back to a frozen bar, importing stuck
         true and the button disabled for good. Timers are throttled in a
         background tab but they still fire, so the run completes either way.
         Progress is read from the clock rather than counted per tick, so the
         throttling changes the smoothness and not the duration. */
      function animate(dur, onStep, onDone) {
        if (!dur) { onStep(1); onDone(); return; }
        var t0 = performance.now();
        var id = window.setInterval(function () {
          var p = Math.min(1, (performance.now() - t0) / dur);
          onStep(p);
          if (p >= 1) { window.clearInterval(id); onDone(); }
        }, 16);
        timers.push(id);
      }
      function cancelProc() {
        timers.forEach(window.clearTimeout); rafs.forEach(window.cancelAnimationFrame);
        timers = []; rafs = [];
      }

      /* ==================================================================
         THE ACTIVE DRAWING
         ------------------------------------------------------------------
         Either the built-in sample or a PDF the visitor picked. Both are the
         same shape, so every step below works on whichever is loaded:

           w, h    page size, normalised so the long side is 800 units. That
                   keeps the overlay's stroke widths and the 13-unit balloon
                   correct on an A4 and on an A0 alike.
           chars   what gets ballooned: { name, nom, tol, ax, ay, bx, by, lx, ly }
           texts   every text run on the page, for Manual map to fall back on
         ================================================================== */
      var SAMPLE_LABEL = svg.getAttribute('aria-label');
      var SAMPLE_DOC = { real: false, w: 800, h: 520, chars: CHARS, texts: null,
                         name: 'BR-2041_sample.pdf' };
      var pageImg = q('.abal__page');
      var fileInput = q('.abal__input');
      var barSub = q('.abal__sub'), barTag = q('.abal__sample');
      var BAR_SUB = barSub ? barSub.textContent : '';
      var BAR_TAG = barTag ? barTag.textContent : '';
      var objectUrl = null;
      state.doc = SAMPLE_DOC;

      function docChars() { return state.doc.chars; }

      /* ==================================================================
         ZOOM
         ------------------------------------------------------------------
         Driven entirely by the SVG viewBox, which means nothing else has to
         know about it: toSvg() already goes through getScreenCTM(), so
         selecting, lassoing and every balloon coordinate keep working at any
         magnification without a single change.
         ================================================================== */
      var MIN_SPAN = 40;                    /* how far in zoom may go */
      var view = null;                      /* null means fitted */
      function fitView() { return { x: 0, y: 0, w: state.doc.w, h: state.doc.h }; }
      function applyView() {
        var v = view || fitView();
        svg.setAttribute('viewBox', v.x + ' ' + v.y + ' ' + v.w + ' ' + v.h);
        var f = fitView();
        q('.abal__zoom-out').disabled = !view;
        q('.abal__zoom-fit').disabled = !view;
        q('.abal__zoom-in').disabled = v.w <= MIN_SPAN;
        svg.classList.toggle('is-zoomed', !!view);
      }
      function clampView(v) {
        var f = fitView();
        v.w = Math.min(f.w, Math.max(MIN_SPAN, v.w));
        v.h = v.w * (f.h / f.w);
        v.x = Math.min(f.w - v.w, Math.max(0, v.x));
        v.y = Math.min(f.h - v.h, Math.max(0, v.y));
        return v;
      }
      /* Zoom about a point so the thing under the cursor stays under it. */
      function zoomAt(factor, cx, cy) {
        var v = view || fitView();
        var f = fitView();
        var nw = Math.min(f.w, Math.max(MIN_SPAN, v.w / factor));
        if (Math.abs(nw - v.w) < 0.01) return;
        var nh = nw * (f.h / f.w);
        var k = nw / v.w;
        var nv = clampView({ x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w: nw, h: nh });
        view = (nv.w >= f.w - 0.5) ? null : nv;
        applyView();
      }
      function zoomCentre(factor) {
        var v = view || fitView();
        zoomAt(factor, v.x + v.w / 2, v.y + v.h / 2);
      }
      function resetView() { view = null; applyView(); }
      /* Client pixels to drawing units, for wheel-at-pointer and panning. */
      function clientToSvg(clientX, clientY) {
        var m = svg.getScreenCTM();
        if (!m) return null;
        var p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
        return p.matrixTransform(m.inverse());
      }

      /* Hide map has to take the value away with its balloon, not just the
         balloon: what is left showing on the drawing is then exactly what has
         not been captured yet, which is what Manual map is for.

         The sample is vector, so its own <text> is switched off - exact, and
         it handles the rotated 60.00 without any bounding-box maths. Each
         characteristic is matched to the nearest text node to its anchor,
         which is where the anchor came from, so no hand-written mapping can
         fall out of step with the drawing. */
      var sampleValueEl = new Map();
      (function mapSampleValues() {
        var texts = $$('text', sheet), taken = [];
        CHARS.forEach(function (c) {
          var best = null, bestD = Infinity;
          texts.forEach(function (t) {
            if (taken.indexOf(t) > -1) return;
            var b;
            try { b = t.getBBox(); } catch (e) { return; }
            if (!b || !b.width) return;
            var cx = b.x + b.width / 2, cy = b.y + b.height / 2;
            var m = t.transform.baseVal.consolidate();
            if (m) {
              var p = svg.createSVGPoint(); p.x = cx; p.y = cy;
              var tp = p.matrixTransform(m.matrix); cx = tp.x; cy = tp.y;
            }
            var d = Math.hypot(cx - c.ax, cy - c.ay);
            if (d < bestD) { bestD = d; best = t; }
          });
          if (best && bestD < 40) {
            sampleValueEl.set(c, best);
            taken.push(best);
            /* Record the value's box, not just its centre, so a leader can
               stop at its edge. Corners are transformed individually because
               one of these labels is rotated and getBBox reports the box
               before the transform. */
            var bb = best.getBBox();
            var tm = best.transform.baseVal.consolidate();
            var xs = [], ys = [];
            [[bb.x, bb.y], [bb.x + bb.width, bb.y],
             [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]]
              .forEach(function (pt) {
                var p = svg.createSVGPoint(); p.x = pt[0]; p.y = pt[1];
                if (tm) p = p.matrixTransform(tm.matrix);
                xs.push(p.x); ys.push(p.y);
              });
            c.vx = Math.min.apply(null, xs); c.vy = Math.min.apply(null, ys);
            c.vw = Math.max.apply(null, xs) - c.vx;
            c.vh = Math.max.apply(null, ys) - c.vy;
          }
        });
      })();

      function applyMask() {
        maskL.textContent = '';
        sampleValueEl.forEach(function (el) { el.style.visibility = ''; });
        if (!state.mapHidden) return;
        state.results.forEach(function (c) {
          var el = sampleValueEl.get(c);
          if (el) { el.style.visibility = 'hidden'; return; }
          /* An imported page is a raster, so the value is covered rather than
             switched off. The pad stops antialiased edges peeking out. */
          if (!c.vw) return;
          var pad = Math.max(1, c.vh * 0.18);
          var r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', c.vx - pad); r.setAttribute('y', c.vy - pad);
          r.setAttribute('width', c.vw + pad * 2); r.setAttribute('height', c.vh + pad * 2);
          r.setAttribute('fill', '#FFFFFF');
          maskL.appendChild(r);
        });
      }
      function sheetBounds() {
        return state.doc.real ? { x: 0, y: 0, w: state.doc.w, h: state.doc.h } : SHEET;
      }

      function applyDoc(doc) {
        if (objectUrl && objectUrl !== doc.url) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
        state.doc = doc;
        /* A new drawing always arrives fitted; applyView owns the viewBox. */
        view = null; applyView();
        if (doc.real) {
          objectUrl = doc.url;
          pageImg.setAttribute('href', doc.url);
          pageImg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', doc.url);
          pageImg.setAttribute('width', doc.w);
          pageImg.setAttribute('height', doc.h);
          pageImg.setAttribute('visibility', 'visible');
          sheet.setAttribute('visibility', 'hidden');
          svg.setAttribute('aria-label', 'Imported engineering drawing: ' + doc.name);
          /* The title bar must stop calling it a sample the moment it is not
             one, and it is worth repeating where the file is being read. */
          if (barSub) barSub.textContent = '· ' + doc.name;
          if (barTag) barTag.textContent = 'Your drawing · read in this browser';
        } else {
          pageImg.setAttribute('visibility', 'hidden');
          pageImg.removeAttribute('href');
          pageImg.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
          sheet.removeAttribute('visibility');
          svg.setAttribute('aria-label', SAMPLE_LABEL);
          if (barSub) barSub.textContent = BAR_SUB;
          if (barTag) barTag.textContent = BAR_TAG;
        }
      }

      /* ---- Reading a picked file ---- */
      /* The interlock. Hiding the button would only be a curtain: the file
         input still exists and a drawing can be dropped straight onto the
         stage. Every route into readFile is refused instead, so "hold user
         live demo" genuinely means no customer drawing is read. */
      function liveDemo() { return mount.getAttribute('data-live-demo') !== 'off'; }

      function readFile(file) {
        if (!liveDemo()) { importDrawing(); return; }   /* sample instead */
        if (!file || state.importing) return;
        var isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
        var isImg = /^image\//.test(file.type);
        if (!isPdf && !isImg) { fileError('That file cannot be read here. Use a PDF, PNG or JPG.'); return; }
        if (file.size > 25 * 1024 * 1024) { fileError('That file is over 25 MB. Try a single-sheet PDF.'); return; }
        startImportUi(file.name);
        (isPdf ? readPdf(file) : readImage(file)).then(function (doc) {
          applyDoc(doc);
          finishImportUi(doc);
        })['catch'](function (err) {
          fileError(err && /pdf lib/.test(String(err.message))
            ? 'The PDF reader could not load. Reload the page and try again.'
            : 'That file could not be read. Try a PDF exported from CAD.');
        });
      }

      function readPdf(file) {
        return loadPdfLib().then(function () {
          return file.arrayBuffer ? file.arrayBuffer() : new Response(file).arrayBuffer();
        }).then(function (buf) {
          return window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        }).then(function (pdf) {
          return pdf.getPage(1);
        }).then(function (page) {
          var base = page.getViewport({ scale: 1 });
          var k = 800 / Math.max(base.width, base.height);
          var W = base.width * k, H = base.height * k;
          /* Raster well above the overlay resolution so the sheet stays
             readable, capped so a large-format drawing cannot blow up the
             canvas on a phone. */
          var rs = Math.min(3, 2200 / Math.max(base.width, base.height));
          var vp = page.getViewport({ scale: rs });
          var cv = document.createElement('canvas');
          cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
          var ctx = cv.getContext('2d');
          /* PDF pages are transparent; without this the drawing renders as
             black-on-navy inside the dark app shell. */
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, cv.width, cv.height);
          return page.render({ canvasContext: ctx, viewport: vp }).promise
            .then(function () { return page.getTextContent(); })
            .then(function (tc) {
              var texts = extractTexts(tc, base, k);
              return new Promise(function (res) {
                cv.toBlob(function (blob) {
                  res({ real: true, w: W, h: H, name: file.name,
                        url: URL.createObjectURL(blob),
                        texts: texts, chars: buildChars(texts, W, H) });
                }, 'image/png');
              });
            });
        });
      }

      function readImage(file) {
        /* A picture has no text layer, so nothing can be read off it. It
           still loads, because Manual map works on anything. */
        return new Promise(function (res, rej) {
          var url = URL.createObjectURL(file);
          var im = new Image();
          im.onload = function () {
            var k = 800 / Math.max(im.naturalWidth, im.naturalHeight);
            res({ real: true, w: im.naturalWidth * k, h: im.naturalHeight * k,
                  name: file.name, url: url, texts: [], chars: [] });
          };
          im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('image failed')); };
          im.src = url;
        });
      }

      /* Every text run, in page coordinates, top-left origin. */
      function extractTexts(tc, vp, k) {
        var out = [];
        (tc.items || []).forEach(function (it) {
          var s = it.str || '';
          if (!s.trim()) return;
          var m = window.pdfjsLib.Util.transform(vp.transform, it.transform);
          var h = Math.hypot(m[2], m[3]) || Math.abs(m[3]) || 8;
          var w = it.width || s.length * h * 0.55;
          out.push({ str: s, x: m[4] * k, y: (m[5] - h) * k, w: w * k, h: h * k });
        });
        return mergeRuns(out);
      }

      /* A PDF splits "120.00 ±0.10" into separate runs, sometimes one per
         glyph. Without stitching them back together the classifier only ever
         sees fragments and the tolerance is lost. */
      function mergeRuns(items) {
        items.sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
        var out = [];
        items.forEach(function (it) {
          var p = out[out.length - 1];
          var em = p ? Math.max(p.h, it.h) : 0;
          if (p && it.x >= p.x &&
              Math.abs((p.y + p.h / 2) - (it.y + it.h / 2)) < em * 0.45 &&
              it.x - (p.x + p.w) < em * 0.9) {
            var gap = it.x - (p.x + p.w);
            p.str += (gap > em * 0.18 ? ' ' : '') + it.str;
            p.w = Math.max(p.x + p.w, it.x + it.w) - p.x;
            p.y = Math.min(p.y, it.y);
            p.h = Math.max(p.h, it.h);
            return;
          }
          out.push({ str: it.str, x: it.x, y: it.y, w: it.w, h: it.h });
        });
        return pairLimits(out);
      }

      /* A limit dimension is written as two numbers stacked, max over min:

             1.220
             1.200

         Left alone that is two balloons and two rows for one characteristic,
         which would be wrong on an inspection plan. Pair them when they sit
         directly above one another, are both pure numbers, and are about one
         line apart - anything looser starts eating unrelated columns. */
      function pairLimits(runs) {
        var isNum = function (s) { return /^\d*\.?\d+$/.test(s.trim()); };
        var dp = function (s) { var m = s.trim().split('.')[1]; return m ? m.length : 0; };
        var used = {}, out = [];
        runs.forEach(function (a, i) {
          if (used[i]) return;
          if (isNum(a.str)) {
            for (var j = i + 1; j < runs.length; j++) {
              var b = runs[j];
              if (used[j] || !isNum(b.str)) continue;
              var gap = b.y - (a.y + a.h);
              if (gap > a.h * 1.1) break;               /* runs are y-sorted */
              var ac = a.x + a.w / 2, bc = b.x + b.w / 2;
              if (gap < -a.h * 0.2) continue;
              if (Math.abs(ac - bc) > Math.max(a.w, b.w) * 0.35) continue;
              var hi = parseFloat(a.str), lo = parseFloat(b.str);
              if (!(hi > lo)) continue;                                /* max over min */
              /* Two stacked numbers are not always limits. A feature control
                 frame's tolerance sitting above another one looks identical
                 in the text layer, and pairing those invents a value that is
                 not on the drawing. Two guards, both cheap and both from how
                 limits are actually written: a max and a min carry the same
                 number of decimal places, and they are close together. When
                 in doubt leave them as two rows - a split characteristic is
                 obvious to the visitor, a fabricated one is not. */
              if (dp(a.str) !== dp(b.str)) continue;
              if (lo / hi < 0.4) continue;
              used[i] = used[j] = true;
              var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
              out.push({ str: a.str.trim() + '/' + b.str.trim(), x: x, y: y,
                         w: Math.max(a.x + a.w, b.x + b.w) - x,
                         h: (b.y + b.h) - y });
              return;
            }
          }
          used[i] = true;
          out.push(a);
        });
        return out;
      }

      function buildChars(texts, W, H) {
        var found = [];
        texts.forEach(function (t) {
          var c = classify(t.str);
          if (c) found.push({ name: c.name, nom: c.nom, tol: c.tol, src: t });
        });
        /* Top to bottom then left to right, the order an inspector numbers a
           sheet in. */
        found.sort(function (a, b) { return (a.src.y - b.src.y) || (a.src.x - b.src.x); });
        return layoutBalloons(found, W, H, []);
      }

      /* Balloons go beside their value, not on top of it, and not on top of
         each other. Four candidate sides, pushed further out each pass until
         one is clear. */
      function layoutBalloons(found, W, H, placed) {
        var R = 13, GAP = R * 2.3;
        return found.map(function (f) {
          var t = f.src;
          var cx = t.x + t.w / 2, cy = t.y + t.h / 2;
          var sides = [
            { x: t.x + t.w + R * 1.5, y: cy },
            { x: cx,                  y: t.y - R * 1.5 },
            { x: t.x - R * 1.5,       y: cy },
            { x: cx,                  y: t.y + t.h + R * 1.5 }
          ];
          var spot = null;
          for (var pass = 0; pass < 7 && !spot; pass++) {
            for (var i = 0; i < sides.length && !spot; i++) {
              var p = { x: sides[i].x + (sides[i].x - cx) * pass * 0.6,
                        y: sides[i].y + (sides[i].y - cy) * pass * 0.6 };
              p.x = Math.max(R + 1, Math.min(W - R - 1, p.x));
              p.y = Math.max(R + 1, Math.min(H - R - 1, p.y));
              var clash = false;
              for (var j = 0; j < placed.length; j++) {
                if (Math.hypot(placed[j].x - p.x, placed[j].y - p.y) < GAP) { clash = true; break; }
              }
              if (!clash) spot = p;
            }
          }
          if (!spot) spot = { x: Math.max(R + 1, Math.min(W - R - 1, cx)),
                              y: Math.max(R + 1, Math.min(H - R - 1, cy)) };
          placed.push(spot);
          /* Leader runs from the balloon edge to the nearest point of the
             value's own box, so it always points at what it labels. */
          var ex = Math.max(t.x, Math.min(t.x + t.w, spot.x));
          var ey = Math.max(t.y, Math.min(t.y + t.h, spot.y));
          var dx = ex - spot.x, dy = ey - spot.y, d = Math.hypot(dx, dy) || 1;
          var off = Math.max(0, (d - LEADER_GAP) / d);
          return { name: f.name, nom: f.nom, tol: f.tol, ax: cx, ay: cy,
                   bx: spot.x, by: spot.y,
                   lx: spot.x + dx * off, ly: spot.y + dy * off,
                   /* The value's own box, so Hide map can cover it. */
                   vx: t.x, vy: t.y, vw: t.w, vh: t.h };
        });
      }

      /* ---- Import panel state ---- */
      function startImportUi(name) {
        state.importing = true;
        q('.abal__import').disabled = true;
        q('.abal__use-sample').disabled = true;
        drop.hidden = true;
        q('.abal__file').hidden = false;
        q('.abal__file-name').textContent = name;
        var st = q('.abal__file-status');
        st.textContent = 'Reading…'; st.classList.remove('is-ok');
        q('.abal__file .abal__bar i').style.width = '40%';
      }
      function finishImportUi(doc) {
        var st = q('.abal__file-status');
        q('.abal__file .abal__bar i').style.width = '100%';
        st.textContent = 'Ready'; st.classList.add('is-ok');
        state.importing = false;
        setStep(2);
        if (!doc.real) return;
        toast(doc.chars.length
          ? 'Read ' + doc.chars.length + ' likely characteristics from this sheet. Auto capture to balloon them, then Manual map for anything missed.'
          : 'No dimension text could be read — this looks like a scan. Balloon it, then use Manual map.');
      }
      function fileError(msg) {
        state.importing = false;
        q('.abal__import').disabled = false;
        q('.abal__use-sample').disabled = false;
        drop.hidden = false;
        q('.abal__file').hidden = true;
        q('.abal__file .abal__bar i').style.width = '0%';
        toast(msg);
      }

      /* ---- Step UI ---- */
      function setStep(n) {
        state.step = n;
        steps.forEach(function (li, i) {
          var isActive = (i + 1 === n), isDone = (i + 1 < n);
          li.classList.toggle('is-active', isActive);
          li.classList.toggle('is-done', isDone);
          li.querySelector('.abal__dot').textContent = isDone ? '✓' : String(i + 1);
          if (isActive) li.setAttribute('aria-current', 'step');
          else li.removeAttribute('aria-current');
        });
        panes[0].hidden = n !== 1;
        panes[1].hidden = n !== 2;
        panes[2].hidden = n < 3;
        q('.abal__foot').hidden = n !== 4;
        /* Hide map and Manual map only mean anything once balloons exist. */
        if (n !== 4) { state.manual = false; state.mapHidden = false; }
        syncMapButtons();
      }

      /* Keeps the two map toggles, the balloon layer and the drag affordance
         in step with the state, so every path that changes step gets it right
         instead of each one remembering to flip three things. */
      function syncMapButtons() {
        var hideBtn = q('.abal__hide'), manBtn = q('.abal__manual');
        if (hideBtn) {
          hideBtn.setAttribute('aria-pressed', String(state.mapHidden));
          hideBtn.textContent = state.mapHidden ? 'Show map' : 'Hide map';
        }
        if (manBtn) manBtn.setAttribute('aria-pressed', String(state.manual));
        blnL.classList.toggle('is-hidden', state.mapHidden);
        applyMask();
        svg.classList.toggle('is-selectable', state.step === 2 || (state.step === 4 && state.manual));
      }

      /* ---- Step 1: import ---- */
      function importDrawing() {
        if (state.step !== 1 || state.importing) return;
        applyDoc(SAMPLE_DOC);
        state.importing = true;
        q('.abal__import').disabled = true;
        q('.abal__use-sample').disabled = true;
        drop.hidden = true;
        q('.abal__file').hidden = false;
        q('.abal__file-name').textContent = SAMPLE_DOC.name;
        var bar = q('.abal__file .abal__bar i'), status = q('.abal__file-status');
        status.textContent = 'Importing…'; status.classList.remove('is-ok');
        animate(reduced ? 0 : 1100, function (p) {
          bar.style.width = (p * 100) + '%';
        }, function () {
          status.textContent = 'Ready'; status.classList.add('is-ok');
          sheet.classList.remove('is-drawing');
          void sheet.getBoundingClientRect();
          sheet.classList.add('is-visible');
          if (!reduced) sheet.classList.add('is-drawing');
          later(function () { state.importing = false; setStep(2); }, reduced ? 0 : 1300);
        });
      }

      /* ---- Step 2: select areas ---- */
      /* A box is a box; a pen stroke is the polygon the visitor traced. The
         bounding box is checked first because it rejects almost everything
         for almost nothing, and the ray cast only runs on what survives. */
      function inside(c, a) {
        if (c.ax < a.x || c.ax > a.x + a.w || c.ay < a.y || c.ay > a.y + a.h) return false;
        if (!a.pts) return true;
        var p = a.pts, hit = false;
        for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
          var yi = p[i][1], yj = p[j][1];
          if ((yi > c.ay) !== (yj > c.ay) &&
              c.ax < (p[j][0] - p[i][0]) * (c.ay - yi) / (yj - yi) + p[i][0]) hit = !hit;
        }
        return hit;
      }
      function ptsBBox(pts) {
        var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
        var x = Math.min.apply(null, xs), y = Math.min.apply(null, ys);
        return { x: x, y: y, w: Math.max.apply(null, xs) - x, h: Math.max.apply(null, ys) - y };
      }
      function ptsPath(pts) {
        return 'M' + pts.map(function (p) {
          return p[0].toFixed(1) + ' ' + p[1].toFixed(1);
        }).join('L') + 'Z';
      }

      function addArea(r, label) {
        if (state.step !== 2) return;
        state.areas.push({ id: state.nextId++, x: r.x, y: r.y, w: r.w, h: r.h,
                           pts: r.pts || null,
                           label: label || (r.pts ? 'Pen selection' : 'Custom selection') });
        renderAreas();
      }
      function removeArea(id) {
        state.areas = state.areas.filter(function (a) { return a.id !== id; });
        renderAreas();
      }
      function renderAreas() {
        areasL.textContent = '';
        var list = q('.abal__areas'); list.textContent = '';
        state.areas.forEach(function (a, i) {
          var g = document.createElementNS(NS, 'g');
          /* A whole-sheet area would wash the entire imported drawing in 10%
             orange and march a dashed border around it forever. Outline only. */
          g.setAttribute('class', 'abal__area' + (a.label === WHOLE_SHEET_LABEL ? ' abal__area--full' : ''));
          /* A pen area draws the traced outline, not its bounding box - the
             whole point of tracing it was that a box would have taken the
             neighbouring view too. */
          var rect;
          if (a.pts) {
            rect = document.createElementNS(NS, 'path');
            rect.setAttribute('d', ptsPath(a.pts));
          } else {
            rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('x', a.x); rect.setAttribute('y', a.y);
            rect.setAttribute('width', a.w); rect.setAttribute('height', a.h); rect.setAttribute('rx', 4);
          }
          /* Keep the tag on the sheet when the box is near the top edge. */
          var tagY = (a.y - 20 < 12) ? a.y + 2 : a.y - 20;
          var tag = document.createElementNS(NS, 'g'); tag.setAttribute('class', 'abal__tag');
          var tr = document.createElementNS(NS, 'rect');
          tr.setAttribute('x', a.x); tr.setAttribute('y', tagY);
          tr.setAttribute('width', 62); tr.setAttribute('height', 18); tr.setAttribute('rx', 3);
          var tt = document.createElementNS(NS, 'text');
          tt.setAttribute('x', a.x + 7); tt.setAttribute('y', tagY + 13);
          tt.textContent = 'AREA ' + (i + 1);
          tag.appendChild(tr); tag.appendChild(tt);
          g.appendChild(rect); g.appendChild(tag); areasL.appendChild(g);

          var li = document.createElement('li');
          var dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true');
          var sp = document.createElement('span'); sp.textContent = 'Area ' + (i + 1) + ' · ' + a.label;
          var btn = document.createElement('button');
          btn.type = 'button'; btn.textContent = '×';
          btn.setAttribute('aria-label', 'Remove area ' + (i + 1));
          on(btn, 'click', function () { removeArea(a.id); });
          li.appendChild(dot); li.appendChild(sp); li.appendChild(btn);
          list.appendChild(li);
        });
        q('.abal__hint').textContent = state.areas.length
          ? 'Add more areas, or start ballooning.'
          : 'No areas selected yet.';
        q('.abal__start').disabled = state.areas.length === 0;
        function has(label) { return state.areas.some(function (a) { return a.label === label; }); }
        /* An imported sheet has no known views, so Auto capture takes the
           whole page and the classifier is what keeps the title block out. */
        q('.abal__q-auto').disabled = state.doc.real
          ? has(WHOLE_SHEET_LABEL)
          : (has(PRESETS.front.label) && has(PRESETS.side.label));
        q('.abal__q-clear').disabled = state.areas.length === 0;
      }

      function toSvg(e) {
        var B = sheetBounds();
        var m = svg.getScreenCTM();
        if (!m) return { x: B.x, y: B.y };
        var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        var p = pt.matrixTransform(m.inverse());
        return {
          x: Math.max(B.x, Math.min(B.x + B.w, p.x)),
          y: Math.max(B.y, Math.min(B.y + B.h, p.y))
        };
      }
      function setMarquee(r) {
        if (!r) { marq.setAttribute('visibility', 'hidden'); return; }
        marq.setAttribute('visibility', 'visible');
        marq.setAttribute('x', r.x); marq.setAttribute('y', r.y);
        marq.setAttribute('width', r.w); marq.setAttribute('height', r.h);
      }
      function norm(a, b) {
        return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
      }

      /* Step 2 boxes choose what to scan. A step-4 box in Manual map picks up
         a value auto capture did not take. Same gesture, same marquee, so the
         drag plumbing is shared and only the pointerup differs. */
      function canDrag() { return state.step === 2 || (state.step === 4 && state.manual); }

      var lasso = q('.abal__lasso');
      function setLasso(pts) {
        if (!pts) { lasso.setAttribute('visibility', 'hidden'); return; }
        lasso.setAttribute('visibility', 'visible');
        lasso.setAttribute('stroke-width', penWidth());
        lasso.setAttribute('d', ptsPath(pts));
      }

      /* One gesture, three jobs, decided at pointerdown and never changed
         mid-drag: pan when the middle button or space says so, trace when the
         Pen is on, box otherwise. */
      var spaceHeld = false;
      on(app, 'keydown', function (e) {
        if (e.key === ' ' && state.step >= 2) { spaceHeld = true; svg.classList.add('is-panning'); }
      });
      on(app, 'keyup', function (e) {
        if (e.key === ' ') { spaceHeld = false; svg.classList.remove('is-panning'); }
      });
      on(window, 'blur', function () { spaceHeld = false; svg.classList.remove('is-panning'); });

      var drag = null;
      /* Where a balloon's leader should stop: just short of the value it
         labels, from wherever the balloon now is. An imported sheet knows the
         value's own box; the sample only knows its anchor point. */
      function leaderFor(c, bx, by) {
        var ex, ey;
        if (c.vw) {
          ex = Math.max(c.vx, Math.min(c.vx + c.vw, bx));
          ey = Math.max(c.vy, Math.min(c.vy + c.vh, by));
        } else { ex = c.ax; ey = c.ay; }
        var dx = ex - bx, dy = ey - by, d = Math.hypot(dx, dy) || 1;
        var off = Math.max(0, (d - LEADER_GAP) / d);
        return { x: bx + dx * off, y: by + dy * off };
      }
      /* Move one balloon without redrawing the rest - a re-render would
         restart every pop animation on a sheet carrying a hundred of them. */
      function updateBalloon(c, g) {
        var i = g.getAttribute('data-i');
        g.querySelector('circle').setAttribute('cx', c.bx);
        g.querySelector('circle').setAttribute('cy', c.by);
        g.querySelector('text').setAttribute('x', c.bx);
        g.querySelector('text').setAttribute('y', c.by);
        var ln = blnL.querySelector('line[data-i="' + i + '"]');
        if (ln) {
          ln.setAttribute('x1', c.bx); ln.setAttribute('y1', c.by);
          ln.setAttribute('x2', c.lx); ln.setAttribute('y2', c.ly);
        }
      }

      on(svg, 'pointerdown', function (e) {
        var panning = (e.button === 1) || (spaceHeld && e.button === 0);
        /* Automatic placement keeps balloons off each other, but it cannot
           know which bit of the drawing matters, so one sometimes settles over
           the value it is pointing at. Dragging it takes priority over every
           other gesture: if the pointer went down on a balloon, that is what
           was being aimed at. */
        var blnEl = !panning && e.button === 0 && e.target.closest
          ? e.target.closest('.abal__bln') : null;
        if (blnEl && state.step === 4 && !state.mapHidden) {
          var c = state.results[+blnEl.getAttribute('data-i')];
          if (c) {
            e.preventDefault();
            var g0 = toSvg(e);
            drag = { id: e.pointerId, bln: c, blnEl: blnEl,
                     gx: c.bx - g0.x, gy: c.by - g0.y };
            svg.classList.add('is-moving-bln');
            try { svg.setPointerCapture(e.pointerId); } catch (err) {}
            return;
          }
        }
        if (!panning && (!canDrag() || e.button > 0)) return;
        if (panning && !view) return;                 /* nothing to pan when fitted */
        e.preventDefault();
        var p = toSvg(e);
        drag = { id: e.pointerId, start: p, pan: panning,
                 pen: !panning && state.tool === 'pen',
                 pts: [[p.x, p.y]],
                 from: view ? { x: view.x, y: view.y } : null,
                 clientX: e.clientX, clientY: e.clientY };
        if (drag.pen) setLasso(drag.pts);
        try { svg.setPointerCapture(e.pointerId); } catch (err) {}
      });
      on(svg, 'pointermove', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        if (drag.bln) {
          var R = state.blnR || 13, p2 = toSvg(e);
          drag.bln.bx = Math.max(R + 1, Math.min(state.doc.w - R - 1, p2.x + drag.gx));
          drag.bln.by = Math.max(R + 1, Math.min(state.doc.h - R - 1, p2.y + drag.gy));
          var L = leaderFor(drag.bln, drag.bln.bx, drag.bln.by);
          drag.bln.lx = L.x; drag.bln.ly = L.y;
          updateBalloon(drag.bln, drag.blnEl);
          return;
        }
        if (drag.pan) {
          /* Move by the pointer's travel in drawing units, measured against
             where the drag began rather than the last frame, so rounding
             cannot accumulate into drift. */
          var f = fitView(), scale = view.w / svg.getBoundingClientRect().width;
          view.x = drag.from.x - (e.clientX - drag.clientX) * scale;
          view.y = drag.from.y - (e.clientY - drag.clientY) * scale;
          clampView(view); applyView();
          return;
        }
        var p = toSvg(e);
        if (drag.pen) {
          /* Thin the stroke as it is drawn: a raw pointer trace is hundreds
             of points, and the ray cast walks every one of them. */
          var last = drag.pts[drag.pts.length - 1];
          var minStep = Math.max(1.5, (view ? view.w : state.doc.w) / 260);
          if (Math.hypot(p.x - last[0], p.y - last[1]) < minStep) return;
          drag.pts.push([p.x, p.y]);
          setLasso(drag.pts);
          return;
        }
        setMarquee(norm(drag.start, p));
      });
      on(svg, 'pointerup', function (e) {
        if (!drag || e.pointerId !== drag.id) return;
        var d = drag; drag = null;
        setMarquee(null); setLasso(null);
        svg.classList.remove('is-moving-bln');
        if (d.bln || d.pan) return;
        var r;
        if (d.pen) {
          if (d.pts.length < 5) return;
          r = ptsBBox(d.pts); r.pts = d.pts;
        } else {
          r = norm(d.start, toSvg(e));
        }
        if (r.w < MIN_AREA || r.h < MIN_AREA) return;
        if (state.step === 4) manualCapture(r); else addArea(r);
      });
      on(svg, 'pointercancel', function () { drag = null; setMarquee(null); setLasso(null); });

      /* Ctrl or Cmd with the wheel zooms at the pointer. A bare wheel is left
         alone so the page still scrolls normally over the drawing. */
      on(svg, 'wheel', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        var p = clientToSvg(e.clientX, e.clientY);
        if (p) zoomAt(e.deltaY < 0 ? 1.25 : 1 / 1.25, p.x, p.y);
      }, { passive: false });

      /* ---- Step 3: ballooning ---- */
      function startBallooning() {
        if (state.step !== 2 || !state.areas.length) return;
        setStep(3);
        /* Each characteristic once, in drawing order, if it sits in any area. */
        state.results = docChars().filter(function (c) {
          return state.areas.some(function (a) { return inside(c, a); });
        });
        /* Fixed once for the run so manually added balloons match the rest. */
        state.blnR = state.results.length > 70 ? 9 : (state.results.length > 35 ? 11 : 13);
        q('.abal__rows').textContent = ''; blnL.textContent = '';
        q('.abal__empty').hidden = true; q('.abal__toast').hidden = true;
        q('.abal__count').textContent = '0 found';
        q('.abal__res-bar i').style.width = '0%';
        q('.abal__status').classList.remove('is-done');
        q('.abal__status-text').textContent = 'Scanning selected areas…';

        scanL.textContent = '';
        var lines = state.areas.map(function (a) {
          var l = document.createElementNS(NS, 'line'); l.setAttribute('class', 'abal__scan');
          l.setAttribute('x1', a.x); l.setAttribute('x2', a.x + a.w);
          l.setAttribute('y1', a.y); l.setAttribute('y2', a.y);
          scanL.appendChild(l); return { l: l, a: a };
        });
        animate(reduced ? 0 : SCAN_MS, function (p) {
          lines.forEach(function (o) {
            var y = o.a.y + o.a.h * p;
            o.l.setAttribute('y1', y); o.l.setAttribute('y2', y);
          });
        }, function () {
          scanL.textContent = '';
          placeBalloons();
        });
      }

      function placeBalloons() {
        var total = state.results.length;
        if (!total) { finish(); return; }
        q('.abal__status-text').textContent = 'Detecting dimensions, tolerances and GD&T…';
        /* The sample has seven characteristics and 420ms apart looks right.
           A real sheet can have two hundred, and 420ms each is a minute and a
           half of animation before the visitor can touch anything. Hold the
           whole reveal to about three and a half seconds instead, however
           many there are. */
        var step = Math.max(16, Math.min(BALLOON_MS, 3500 / total));
        state.results.forEach(function (c, i) {
          later(function () {
            var n = i + 1;
            drawResult(c, i);
            q('.abal__count').textContent = n + ' found';
            q('.abal__res-bar i').style.width = Math.round((n / total) * 100) + '%';
            if (n === total) later(finish, reduced ? 0 : 400);
          }, reduced ? 0 : 150 + i * step);
        });
      }

      /* One balloon plus its table row. Shared by the scan and by Manual map,
         so a manually boxed value is the same object as an auto-captured one -
         same numbering, same hover link, same export row. */
      function drawResult(c, i) {
        var n = i + 1;
      var leader = document.createElementNS(NS, 'line');
      leader.setAttribute('class', 'abal__leader');
      leader.setAttribute('data-i', i);   /* so a dragged balloon can find it */
      leader.setAttribute('x1', c.bx); leader.setAttribute('y1', c.by);
      leader.setAttribute('x2', c.lx); leader.setAttribute('y2', c.ly);
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'abal__bln'); g.setAttribute('data-i', i);
      /* Thirteen units suits the sample's seven balloons. A real sheet can
         carry a hundred and thirty, and at that size they bury the drawing
         they are annotating. The font goes through style rather than an
         attribute, because the stylesheet's font-size would win over one. */
      var R = state.blnR || 13;
      var circ = document.createElementNS(NS, 'circle');
      circ.setAttribute('cx', c.bx); circ.setAttribute('cy', c.by); circ.setAttribute('r', R);
      var txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', c.bx); txt.setAttribute('y', c.by); txt.textContent = n;
      if (R !== 13) txt.style.fontSize = R + 'px';
      g.appendChild(circ); g.appendChild(txt);
      blnL.appendChild(leader); blnL.appendChild(g);

      var tr = document.createElement('tr');
      tr.className = 'abal__r'; tr.setAttribute('data-i', i);
      var td1 = document.createElement('td');
      var num = document.createElement('span'); num.className = 'abal__num'; num.textContent = n;
      td1.appendChild(num);
      var td2 = document.createElement('td'); td2.textContent = c.name;
      var td3 = document.createElement('td'); td3.className = 'is-mono'; td3.textContent = c.nom;
      var td4 = document.createElement('td'); td4.className = 'is-tol'; td4.textContent = c.tol;
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);

      /* Row actions. The menu is a second <tr> rather than a popover: the
         table scrolls inside a capped panel, and an absolutely positioned
         menu on the last visible row would be clipped by it. */
      var td5 = document.createElement('td');
      td5.className = 'abal__r-act';
      var dots = document.createElement('button');
      dots.type = 'button'; dots.className = 'abal__dots-btn';
      dots.setAttribute('aria-label', 'Actions for characteristic ' + n);
      dots.setAttribute('aria-expanded', 'false');
      dots.innerHTML = '<svg viewBox="0 0 4 16" aria-hidden="true">' +
        '<circle cx="2" cy="3" r="1.4"/><circle cx="2" cy="8" r="1.4"/><circle cx="2" cy="13" r="1.4"/></svg>';
      td5.appendChild(dots);
      tr.appendChild(td5);
      q('.abal__rows').appendChild(tr);
      on(dots, 'click', function () { toggleRowMenu(tr, c, dots); });

      [g, tr].forEach(function (el) {
        on(el, 'mouseenter', function () { hot(i, true); });
        on(el, 'mouseleave', function () { hot(i, false); });
      });
      }

      /* ---- Edit and delete a captured characteristic ---- */
      function closeRowMenus() {
        $$('.abal__r-menu', q('.abal__rows')).forEach(function (r) { r.remove(); });
        $$('.abal__dots-btn', q('.abal__rows')).forEach(function (b) {
          b.setAttribute('aria-expanded', 'false');
        });
      }
      function menuRow(after) {
        var tr = document.createElement('tr');
        tr.className = 'abal__r-menu';
        var td = document.createElement('td');
        td.colSpan = 5;
        var box = document.createElement('div');
        box.className = 'abal__r-menu-in';
        td.appendChild(box);
        tr.appendChild(td);
        after.parentNode.insertBefore(tr, after.nextSibling);
        return box;
      }
      /* The table scrolls inside a capped panel, so a menu opened on a row
         near the bottom can land below the fold with its Save button out of
         reach. Nudge the panel rather than call scrollIntoView, which would
         also scroll the page. */
      function revealRow(el) {
        var wrap = q('.abal__table-wrap');
        if (!wrap) return;
        var wr = wrap.getBoundingClientRect(), er = el.getBoundingClientRect();
        if (er.bottom > wr.bottom) wrap.scrollTop += (er.bottom - wr.bottom) + 10;
        else if (er.top < wr.top) wrap.scrollTop -= (wr.top - er.top) + 10;
      }
      function mkBtn(label, cls) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'abal__btn abal__btn--sm' + (cls ? ' ' + cls : '');
        b.textContent = label;
        return b;
      }
      function toggleRowMenu(tr, c, dots) {
        var open = dots.getAttribute('aria-expanded') === 'true';
        closeRowMenus();
        if (open) return;
        dots.setAttribute('aria-expanded', 'true');
        var td = menuRow(tr);
        var edit = mkBtn('Edit'), del = mkBtn('Delete', 'abal__btn--danger'), cancel = mkBtn('Cancel');
        td.appendChild(edit); td.appendChild(del); td.appendChild(cancel);
        on(cancel, 'click', closeRowMenus);
        on(del, 'click', function () { deleteResult(c); });
        on(edit, 'click', function () { closeRowMenus(); editRow(tr, c, dots); });
        revealRow(td.parentNode);
      }
      function editRow(tr, c, dots) {
        dots.setAttribute('aria-expanded', 'true');
        var td = menuRow(tr);
        var form = document.createElement('div');
        form.className = 'abal__edit-form';
        var fields = [
          { k: 'name', label: 'Characteristic' },
          { k: 'nom',  label: 'Nominal' },
          { k: 'tol',  label: 'Tolerance' }
        ].map(function (f) {
          var wrap = document.createElement('label');
          wrap.className = 'abal__edit-field';
          var sp = document.createElement('span'); sp.textContent = f.label;
          var inp = document.createElement('input');
          inp.type = 'text'; inp.value = c[f.k] === '—' ? '' : c[f.k];
          wrap.appendChild(sp); wrap.appendChild(inp);
          form.appendChild(wrap);
          return { k: f.k, inp: inp };
        });
        var row = document.createElement('div');
        row.className = 'abal__edit-actions';
        var save = mkBtn('Save'), cancel = mkBtn('Cancel');
        save.classList.add('abal__btn--primary');
        row.appendChild(save); row.appendChild(cancel);
        form.appendChild(row);
        td.appendChild(form);
        revealRow(td.parentNode);
        fields[0].inp.focus();
        on(cancel, 'click', closeRowMenus);
        on(form, 'keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); save.click(); }
          if (e.key === 'Escape') { e.preventDefault(); closeRowMenus(); }
        });
        on(save, 'click', function () {
          fields.forEach(function (f) {
            var v = f.inp.value.trim();
            c[f.k] = v || (f.k === 'name' ? 'Characteristic' : '—');
          });
          closeRowMenus();
          renderResults();
          toast('Row updated.');
        });
      }
      function deleteResult(c) {
        var at = state.results.indexOf(c);
        if (at < 0) return;
        state.results.splice(at, 1);
        closeRowMenus();
        renderResults();
        toast(state.results.length
          ? 'Removed. ' + state.results.length + ' characteristics left.'
          : 'Removed. Nothing captured now.');
      }
      /* Balloons carry their number, so a delete has to redraw the lot rather
         than pull one out and leave a gap in the sequence. */
      function renderResults() {
        closeRowMenus();
        blnL.textContent = '';
        q('.abal__rows').textContent = '';
        state.results.forEach(function (c, i) { drawResult(c, i); });
        q('.abal__count').textContent = state.results.length + ' found';
        q('.abal__empty').hidden = state.results.length > 0;
        q('.abal__status-text').textContent = state.results.length
          ? 'Complete — ' + state.results.length + ' characteristics ballooned'
          : 'Nothing captured';
        applyMask();
      }

      /* The sample has a known place to point at; an imported sheet does not,
         and on a scan there may be no readable text anywhere. */
      function manualNoneMsg() {
        if (!state.doc.real) return 'Nothing uncaptured in that box. Try the notes under the views.';
        return (state.doc.texts && state.doc.texts.length)
          ? 'No unread value in that box. Draw it tighter around the number.'
          : 'This sheet has no readable text — it is a scan, so there is nothing to pick up.';
      }

      /* ---- Manual map: box a value auto capture did not take ---- */
      function manualCapture(r) {
        var found = docChars().filter(function (c) {
          return inside(c, r) && state.results.indexOf(c) === -1;
        });
        /* On an imported sheet, also take text the classifier passed over.
           That is what Manual map is for: the visitor can see it is a
           characteristic even when the rules would not commit to it. */
        if (!found.length && state.doc.real) {
          /* A value carries a digit. Without that filter a box drawn over the
             title block returns its labels - NAME, SCALE, SHEET - as
             characteristics. */
          var hits = (state.doc.texts || []).filter(function (t) {
            if (t.used || !/\d/.test(t.str)) return false;
            return inside({ ax: t.x + t.w / 2, ay: t.y + t.h / 2 }, r);
          });
          /* "Draw a square above the value" is aimed at one thing. A box that
             catches a crowd is a box drawn too loosely, and silently adding
             twenty rows from it is worse than asking again. */
          if (hits.length > MANUAL_MAX) {
            toast('That box covers ' + hits.length + ' values. Draw it tighter around the one you want.');
            return;
          }
          var placed = state.results.map(function (c) { return { x: c.bx, y: c.by }; });
          hits.forEach(function (t) {
            t.used = true;
            var c = classify(t.str) || { name: 'Manual entry', nom: t.str.trim(), tol: '—' };
            var laid = layoutBalloons([{ name: c.name, nom: c.nom, tol: c.tol, src: t }],
                                      state.doc.w, state.doc.h, placed)[0];
            state.doc.chars.push(laid);
            found.push(laid);
          });
        }
        if (!found.length) { toast(manualNoneMsg()); return; }
        found.forEach(function (c) {
          var i = state.results.length;
          state.results.push(c);
          drawResult(c, i);
        });
        q('.abal__empty').hidden = true;
        q('.abal__count').textContent = state.results.length + ' found';
        q('.abal__status-text').textContent =
          'Complete — ' + state.results.length + ' characteristics ballooned';
        /* With Hide map on, the value the visitor just boxed disappears with
           the rest of the captured ones. That is the feedback: it has moved
           from what is left to what is done. */
        applyMask();
        toast(found.length === 1
          ? 'Manual map: 1 characteristic added.'
          : 'Manual map: ' + found.length + ' characteristics added.');
      }

      function finish() {
        q('.abal__status').classList.add('is-done');
        q('.abal__res-bar i').style.width = '100%';
        if (!state.results.length) {
          q('.abal__empty').hidden = false;
          q('.abal__status-text').textContent = 'Nothing to balloon in this selection';
        } else {
          q('.abal__status-text').textContent = 'Complete — ' + state.results.length + ' characteristics ballooned';
        }
        setStep(4);
      }

      function hot(i, isOn) {
        $$('.abal__bln', blnL).forEach(function (g) {
          g.classList.toggle('is-hot', isOn && +g.getAttribute('data-i') === i);
        });
        $$('tr', q('.abal__rows')).forEach(function (tr) {
          tr.classList.toggle('is-hot', isOn && +tr.getAttribute('data-i') === i);
        });
      }

      /* ---- Step 4 actions ---- */
      var toastT = null;
      function toast(msg) {
        var t = q('.abal__toast');
        t.textContent = msg; t.hidden = false;
        window.clearTimeout(toastT);
        toastT = window.setTimeout(function () { t.hidden = true; }, 3200);
      }
      function editSelection() {
        if (state.step !== 4) return;
        cancelProc();
        blnL.textContent = ''; scanL.textContent = ''; q('.abal__rows').textContent = '';
        state.results = [];
        q('.abal__toast').hidden = true;
        setStep(2); renderAreas();
      }
      function resetAll() {
        cancelProc();
        drag = null; setMarquee(null);
        state.importing = false; state.areas = []; state.results = []; state.nextId = 1;
        state.mapHidden = false; state.manual = false; state.tool = 'box';
        setLasso(null); syncTool(); resetView();
        areasL.textContent = ''; scanL.textContent = ''; blnL.textContent = '';
        q('.abal__rows').textContent = '';
        sheet.classList.remove('is-visible'); sheet.classList.remove('is-drawing');
        /* Back to the sample, and the imported page's blob is released. */
        applyDoc(SAMPLE_DOC);
        if (fileInput) fileInput.value = '';
        drop.hidden = false;
        q('.abal__file').hidden = true;
        q('.abal__file .abal__bar i').style.width = '0%';
        q('.abal__import').disabled = false;
        q('.abal__use-sample').disabled = false;
        q('.abal__toast').hidden = true;
        renderAreas();
        setStep(1);
      }

      /* ---- Wiring ---- */
      /* Import drawing now opens the picker and reads the real file; the
         sample is its own button so the demo story still works. */
      /* With the demo held, the drop zone still works - it just loads the
         sample, which is what it now says it will do. */
      function pickFile() {
        if (state.importing) return;
        if (!liveDemo()) { importDrawing(); return; }
        fileInput.click();
      }
      on(q('.abal__import'), 'click', pickFile);
      on(q('.abal__use-sample'), 'click', importDrawing);
      on(fileInput, 'change', function () {
        var f = fileInput.files && fileInput.files[0];
        /* Cleared so picking the same file twice still fires a change. */
        readFile(f); fileInput.value = '';
      });
      on(drop, 'click', pickFile);
      on(drop, 'keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFile(); }
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        on(drop, ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
      });
      on(drop, 'dragleave', function () { drop.classList.remove('is-over'); });
      on(drop, 'drop', function (e) {
        e.preventDefault(); drop.classList.remove('is-over');
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) readFile(f); else importDrawing();
      });
      /* On the sample, Auto capture takes both views in one go and leaves the
         notes and title block alone - that is what Manual map is for. An
         imported sheet has no known views, so it takes the whole page and the
         classifier is what keeps the title block out of the table. */
      on(q('.abal__q-auto'), 'click', function () {
        if (state.step !== 2) return;
        if (state.doc.real) {
          if (!state.areas.some(function (a) { return a.label === WHOLE_SHEET_LABEL; })) {
            addArea({ x: 0, y: 0, w: state.doc.w, h: state.doc.h }, WHOLE_SHEET_LABEL);
          }
          return;
        }
        ['front', 'side'].forEach(function (k) {
          var p = PRESETS[k];
          if (!state.areas.some(function (a) { return a.label === p.label; })) addArea(p, p.label);
        });
      });
      on(q('.abal__q-clear'), 'click', function () { state.areas = []; renderAreas(); });
      /* The Pen exists because a box cannot isolate one view on a sheet where
         the views sit shoulder to shoulder - it always takes the neighbour
         too. Tracing the view means the scan only sees what belongs to it. */
      on(q('.abal__q-pen'), 'click', function () {
        state.tool = state.tool === 'pen' ? 'box' : 'pen';
        syncTool();
        if (state.tool === 'pen') toast(PEN_ON_MSG);
      });
      function syncTool() {
        var b = q('.abal__q-pen');
        if (b) b.setAttribute('aria-pressed', String(state.tool === 'pen'));
        svg.classList.toggle('is-pen', state.tool === 'pen');
        var size = q('.abal__pen-size');
        if (size) size.hidden = state.tool !== 'pen';
      }
      /* Thickness is in drawing units, and the drawing is normalised to 800
         across, so the same setting looks the same on any sheet size. It is
         divided by the zoom so the line stays the width it was set to on
         screen instead of fattening as you magnify - which is the whole point
         when tracing between two views that nearly touch. */
      function penWidth() {
        var w = parseFloat(q('.abal__pen-range').value) || 1.6;
        var z = view ? (view.w / fitView().w) : 1;
        return w * z;
      }
      function applyPenWidth() {
        lasso.setAttribute('stroke-width', penWidth());
        q('.abal__pen-val').textContent = parseFloat(q('.abal__pen-range').value).toFixed(1);
      }
      on(q('.abal__pen-range'), 'input', applyPenWidth);
      applyPenWidth();
      on(q('.abal__zoom-in'),  'click', function () { zoomCentre(1.4); });
      on(q('.abal__zoom-out'), 'click', function () { zoomCentre(1 / 1.4); });
      on(q('.abal__zoom-fit'), 'click', resetView);
      on(q('.abal__hide'), 'click', function () {
        state.mapHidden = !state.mapHidden;
        syncMapButtons();
      });
      on(q('.abal__manual'), 'click', function () {
        state.manual = !state.manual;
        /* Deliberately leaves Hide map alone. The two are meant to be used
           together: hide what has been captured, and what is still showing on
           the drawing is exactly what needs boxing. Turning the values back on
           here would undo the reason for reaching for this button. */
        syncMapButtons();
        if (state.manual) toast(state.mapHidden ? MANUAL_HIDDEN_MSG : MANUAL_ON_MSG);
      });
      on(q('.abal__start'),   'click', startBallooning);
      /* Both are links to the contact page now, so no click handlers. The
         autoplay still narrates the export with EXPORT_MSG. */
      on(q('.abal__edit'),    'click', editSelection);
      on(q('.abal__restart'), 'click', resetAll);

      /* ---- Demo autoplay ---- */
      var token = 0, autoRunning = false, mode = reduced ? 'manual' : 'auto';
      var btnAuto = q('.abal__mode-auto'), btnManual = q('.abal__mode-manual');
      function sleep(ms) { return new Promise(function (r) { window.setTimeout(r, ms); }); }

      function setMode(m) {
        mode = m;
        btnAuto.setAttribute('aria-pressed', String(m === 'auto'));
        btnManual.setAttribute('aria-pressed', String(m === 'manual'));
      }
      function stopAuto() {
        token++; autoRunning = false;
        cursor.classList.remove('is-on');
        setMarquee(null);
      }
      function toApp(x, y) { var r = app.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; }
      function elCenter(el) { var r = el.getBoundingClientRect(); return toApp(r.left + r.width / 2, r.top + r.height / 2); }
      function svgToApp(x, y) {
        var pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
        var m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
        var s = pt.matrixTransform(m); return toApp(s.x, s.y);
      }
      function placeCursor(p, instant) {
        cursor.classList.toggle('no-ease', !!instant);
        cursor.style.transform = 'translate(' + p.x + 'px, ' + p.y + 'px)';
      }
      function press(el) {
        cursor.classList.remove('is-click'); void cursor.offsetWidth; cursor.classList.add('is-click');
        el.classList.add('is-pressed');
        return sleep(160).then(function () { el.classList.remove('is-pressed'); });
      }
      function dragAreaDemo(area, alive, done) {
        placeCursor(svgToApp(area.x, area.y));
        return sleep(750).then(function () {
          if (!alive()) return null;
          var start = { x: area.x, y: area.y }, dur = 800, t0 = performance.now();
          return new Promise(function (res) {
            (function step(now) {
              if (!alive()) { setMarquee(null); res(); return; }
              var p = Math.min(1, ((now || performance.now()) - t0) / dur);
              var e = 1 - Math.pow(1 - p, 3);
              var cur = { x: start.x + area.w * e, y: start.y + area.h * e };
              setMarquee(norm(start, cur));
              placeCursor(svgToApp(cur.x, cur.y), true);
              if (p < 1) window.requestAnimationFrame(step); else res();
            })(performance.now());
          });
        }).then(function () {
          if (!alive()) return;
          setMarquee(null);
          if (done) done(area); else addArea(area, area.label);
        });
      }

      async function autoplay() {
        var t = ++token;
        function alive() { return t === token && mode === 'auto'; }
        autoRunning = true;
        while (alive()) {
          resetAll();
          cursor.classList.add('is-on');
          placeCursor({ x: app.clientWidth * 0.5, y: app.clientHeight * 0.85 }, true);
          await sleep(700); if (!alive()) break;
          /* The scripted demo uses the sample; Import drawing opens a real
             file picker and a script must never do that to a visitor. */
          placeCursor(elCenter(q('.abal__use-sample'))); await sleep(800); if (!alive()) break;
          await press(q('.abal__use-sample')); importDrawing();
          await sleep(2700); if (!alive()) break;
          await dragAreaDemo(PRESETS.front, alive); if (!alive()) break;
          await sleep(400);
          await dragAreaDemo(PRESETS.side, alive); if (!alive()) break;
          await sleep(500);
          placeCursor(elCenter(q('.abal__start'))); await sleep(800); if (!alive()) break;
          await press(q('.abal__start')); startBallooning();
          while (alive() && state.step !== 4) await sleep(200);
          if (!alive()) break;
          /* Hover a row to show the link between table and drawing. */
          var row = q('.abal__rows').children[2];
          if (row) {
            placeCursor(elCenter(row)); await sleep(800); if (!alive()) break;
            hot(2, true); await sleep(1600); hot(2, false);
          }
          if (!alive()) break;
          /* Manual map picking up the two notes the scan leaves alone. This is
             the honest half of the story: auto capture takes the views, a box
             takes whatever it did not. */
          var manBtn = q('.abal__manual');
          placeCursor(elCenter(manBtn)); await sleep(700); if (!alive()) break;
          await press(manBtn);
          state.manual = true; syncMapButtons(); toast(MANUAL_ON_MSG);
          await sleep(700); if (!alive()) break;
          await dragAreaDemo(NOTES_BOX, alive, manualCapture); if (!alive()) break;
          await sleep(1400);
          if (!alive()) break;
          placeCursor(elCenter(q('.abal__export'))); await sleep(900); if (!alive()) break;
          await press(q('.abal__export')); toast(EXPORT_MSG);
          await sleep(3500);
        }
        if (t === token) { autoRunning = false; cursor.classList.remove('is-on'); }
      }

      /* Any real click or key press inside the demo hands over to the visitor. */
      function takeOver(e) {
        if (mode !== 'auto' || !e.isTrusted) return;
        stopAuto(); setMode('manual');
      }
      on(app, 'pointerdown', takeOver, true);
      on(app, 'keydown', takeOver, true);

      on(btnAuto, 'click', function () {
        if (mode === 'auto' && autoRunning) return;
        setMode('auto'); autoplay();
      });
      on(btnManual, 'click', function () {
        if (mode === 'manual') return;
        stopAuto(); setMode('manual'); resetAll();
      });

      /* Only run while on screen, and never under reduced motion. */
      if (!reduced && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (mode !== 'auto') return;
            if (e.isIntersecting && !autoRunning) autoplay();
            if (!e.isIntersecting && autoRunning) stopAuto();
          });
        }, { threshold: 0.3 }).observe(app);
      }
      on(document, 'visibilitychange', function () {
        if (document.hidden && autoRunning) stopAuto();
      });

      setMode(mode);
      resetAll();
      mount.setAttribute('data-abal-ready', '');
    }
  }
  function initWhatWeDo() {
    var mounts = $$('[data-wwd]');
    if (!mounts.length) return;

    mounts.forEach(function (mount) { build(mount); });

    function read(cell) {
      var tag = cell.querySelector('.cell__tag');
      var h   = cell.querySelector('h3, h4');
      var p   = cell.querySelector('p');
      return {
        tag:  tag ? tag.textContent.trim() : '',
        name: h ? h.textContent.trim() : '',
        desc: p ? p.textContent.trim() : '',
        href: cell.getAttribute('href') || ''
      };
    }

    function build(mount) {
      var svcSrc = mount.querySelector('[data-wwd-services]');
      var modSrc = mount.querySelector('[data-wwd-modules]');
      var acc    = mount.querySelector('.wwd__acc');
      var mods   = mount.querySelector('.wwd__mods');
      var out    = mount.querySelector('.wwd__readtext');
      if (!svcSrc || !modSrc || !acc || !mods || !out) return;

      var services = $$('.cell', svcSrc).map(read);
      var modules  = $$('.cell', modSrc).map(read);
      if (services.length !== 4 || modules.length !== 6) return;
      if (services.concat(modules).some(function (x) { return !x.name || !x.href; })) return;

      /* ---- Accordion: one open at a time, first open ---- */
      var items = services.map(function (s, i) {
        var li = document.createElement('li');
        li.className = 'wwd__item';

        var id = 'wwd-panel-' + i;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wwd__toggle';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', id);

        var n = document.createElement('span');
        n.className = 'wwd__n';
        n.textContent = ('0' + (i + 1)).slice(-2);

        var nm = document.createElement('span');
        nm.className = 'wwd__name';
        nm.textContent = s.name;

        var ic = document.createElement('span');
        ic.className = 'wwd__icon';
        ic.setAttribute('aria-hidden', 'true');
        ic.innerHTML = '<svg width="12" height="12" viewBox="0 0 14 14" fill="none">' +
          '<path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

        btn.appendChild(n); btn.appendChild(nm); btn.appendChild(ic);

        var panel = document.createElement('div');
        panel.className = 'wwd__panel';
        panel.id = id;
        var inner = document.createElement('div');
        var p = document.createElement('p');
        p.textContent = s.desc;
        inner.appendChild(p);

        /* The tag is a list of technologies joined by a separator. Split it
           back apart for the chips; a tag with no separator is one chip. */
        var chips = s.tag.split(/\s*[·|/]\s*/).filter(function (t) { return t.trim(); });
        if (chips.length) {
          var box = document.createElement('div');
          box.className = 'wwd__tags';
          chips.forEach(function (t) {
            var c = document.createElement('span');
            c.textContent = t.trim();
            box.appendChild(c);
          });
          inner.appendChild(box);
        }
        panel.appendChild(inner);

        li.appendChild(btn); li.appendChild(panel);
        on(btn, 'click', function () {
          open(li.classList.contains('is-open') ? -1 : i);
        });
        acc.appendChild(li);
        return li;
      });

      function open(i) {
        items.forEach(function (li, j) {
          var isOpen = (j === i);
          li.classList.toggle('is-open', isOpen);
          li.querySelector('.wwd__toggle').setAttribute('aria-expanded', String(isOpen));
        });
      }
      open(0);

      /* ---- Module tiles + readout ---- */
      var tiles = modules.map(function (m, i) {
        var a = document.createElement('a');
        a.className = 'wwd__mod';
        a.href = m.href;

        var b = document.createElement('b');
        /* "MAPP EYE" -> "EYE"; the card it sits in is already called MAPP. */
        b.textContent = m.tag.replace(/^MAPP\s+/i, '') || m.name;

        var s = document.createElement('span');
        s.textContent = m.name;

        a.appendChild(b); a.appendChild(s);
        on(a, 'mouseenter', function () { show(i); });
        on(a, 'focus', function () { show(i); });
        mods.appendChild(a);
        return a;
      });

      function show(i) {
        tiles.forEach(function (t, j) { t.classList.toggle('is-active', j === i); });
        var m = modules[i];
        out.textContent = m.tag + ' — ' + m.desc;
        /* Restart the fade on each change. */
        out.style.animation = 'none';
        void out.offsetWidth;
        out.style.animation = '';
      }
      show(0);

      mount.setAttribute('data-wwd-ready', '');

      /* ---- The one entrance, once ----
         Geometry as well as the observer: IntersectionObserver callbacks are
         deferred while a document is hidden, so a page opened in a background
         tab would come back to a pair that never arrived. */
      function reveal() { mount.classList.add('is-in'); }
      if (prefersReduced()) { reveal(); return; }

      function inView() {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var r = mount.getBoundingClientRect();
        return r.top < vh * 0.85 && r.bottom > 0;
      }
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es, obs) {
          if (es.some(function (e) { return e.isIntersecting; })) { reveal(); obs.disconnect(); }
        }, { threshold: 0.15 });
        io.observe(mount);
      }
      var sweep = throttle(function () {
        if (inView()) { reveal(); window.removeEventListener('scroll', sweep); }
      }, 150);
      on(window, 'scroll', sweep, { passive: true });
      on(window, 'resize', sweep, { passive: true });
      if (inView()) reveal();
    }
  }
  function initStepFlow() {
    var mounts = $$('[data-steps]');
    if (!mounts.length) return;

    var STEP  = 3000;
    var PAUSE = 9000;

    mounts.forEach(function (src) { build(src); });

    function build(src) {
      var items = $$('.timeline__item', src);
      if (items.length !== 6) return;        /* the row geometry is six-wide */

      var steps = items.map(function (it) {
        var tag = it.querySelector('.timeline__step');
        var h   = it.querySelector('h3, h4');
        var p   = it.querySelector('p');
        return {
          /* Verbatim - the two pages label their steps differently
             ("STEP 01" against plain "01") and each keeps its own wording. */
          n:     tag ? tag.textContent.trim() : '',
          title: h ? h.textContent.trim() : '',
          desc:  p ? p.textContent.trim() : ''
        };
      });
      if (steps.some(function (s) { return !s.title || !s.desc; })) return;

      var wrap = document.createElement('div');
      wrap.className = 'steps';
      wrap.style.setProperty('--step-dur', STEP + 'ms');

      var row = document.createElement('ol');
      row.className = 'steps__row';
      row.setAttribute('aria-label', 'Delivery steps');

      var active = 0, pausedUntil = 0, inView = false, timer = null;

      var buttons = steps.map(function (s, i) {
        var li = document.createElement('li');
        var b  = document.createElement('button');
        b.type = 'button';
        b.className = 'steps__step';

        var bar = document.createElement('span');
        bar.className = 'steps__bar';
        bar.setAttribute('aria-hidden', 'true');
        bar.appendChild(document.createElement('i'));

        var n = document.createElement('span');
        n.className = 'steps__n';
        n.textContent = s.n;

        var t = document.createElement('span');
        t.className = 'steps__title';
        t.textContent = s.title;

        b.appendChild(bar); b.appendChild(n); b.appendChild(t);
        on(b, 'click', function () { select(i, true); });
        li.appendChild(b); row.appendChild(li);
        return b;
      });

      var card = document.createElement('div');
      card.className = 'steps__card';
      card.setAttribute('aria-live', 'polite');
      var body = document.createElement('div');
      body.className = 'steps__body';
      card.appendChild(body);

      wrap.appendChild(row); wrap.appendChild(card);
      src.parentNode.insertBefore(wrap, src);

      function fill(i) {
        /* textContent throughout - this is page copy, not markup. */
        body.textContent = '';
        var num = document.createElement('span');
        num.className = 'steps__num';
        num.textContent = ('0' + (i + 1)).slice(-2);
        var d = document.createElement('p');
        d.className = 'steps__desc';
        d.textContent = steps[i].desc;
        body.appendChild(num); body.appendChild(d);
      }

      function render() {
        var held = Date.now() < pausedUntil;
        buttons.forEach(function (b, i) {
          b.classList.toggle('is-done', i < active);
          b.classList.remove('is-active');
          b.classList.remove('is-held');
          b.setAttribute('aria-current', i === active ? 'step' : 'false');
        });
        /* Force a reflow so the fill animation restarts rather than
           continuing from wherever the previous bar had got to. */
        void buttons[active].offsetWidth;
        buttons[active].classList.add(held ? 'is-held' : 'is-active');
        fill(active);
      }

      /* The six descriptions are different lengths, so letting the card size
         itself would reflow the page every three seconds. Measure the tallest
         once and hold it.

         The floor goes on the BODY, not the card. Everything here is
         border-box, so a min-height on the card would have to include its own
         padding to bind at all - set from a content measurement it just sits
         below the natural height and does nothing. */
      function lock() {
        var keep = active, tallest = 0, i;
        body.style.minHeight = '';
        for (i = 0; i < steps.length; i++) {
          fill(i);
          tallest = Math.max(tallest, body.offsetHeight);
        }
        body.style.minHeight = tallest + 'px';
        active = keep;
        fill(active);
      }

      function running() {
        return inView && !document.hidden && Date.now() >= pausedUntil && !prefersReduced();
      }
      function schedule() {
        /* Idempotent on purpose. This is called from scroll and resize, and
           the old body cleared the pending timer and started a fresh
           full-length one every time - so while the page was being scrolled
           the countdown never finished and nothing advanced. Measured: six
           seconds of scrolling, zero moves. Stop a countdown when the
           component should not be running, but never restart one that is
           already ticking. */
        if (!running()) { if (timer) { window.clearTimeout(timer); timer = null; } return; }
        if (timer) return;
        timer = window.setTimeout(tick, STEP);
      }
      function tick() {
        timer = null;
        if (!running()) return;
        active = (active + 1) % steps.length;
        render();
        schedule();
      }
      function select(i, byUser) {
        active = i;
        if (byUser) pausedUntil = Date.now() + PAUSE;
        render();
        schedule();
        if (byUser) window.setTimeout(function () { render(); schedule(); }, PAUSE + 60);
      }

      lock();
      render();
      src.setAttribute('data-steps-ready', '');

      /* Geometry as well as the observer: IntersectionObserver callbacks are
         deferred while a document is hidden, so a page opened in a background
         tab would come back to a row that never started. */
      function measure() {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var r = row.getBoundingClientRect();
        var seen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        inView = r.height > 0 && (seen / r.height) > 0.35;
      }
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { inView = e.isIntersecting; });
          schedule();
        }, { threshold: 0.35 }).observe(row);
      }
      var again  = throttle(function () { measure(); schedule(); }, 150);
      var relock = throttle(function () { lock(); render(); }, 250);
      on(window, 'scroll', again, { passive: true });
      on(window, 'resize', again, { passive: true });
      on(window, 'resize', relock, { passive: true });
      on(document, 'visibilitychange', schedule);
      if (reduceMotion.addEventListener) on(reduceMotion, 'change', schedule);
      measure();
      schedule();
    }
  }
  function initMappOrbit() {
    var mounts = $$('[data-orbit]');
    if (!mounts.length) return;

    var CYCLE = 3200;
    var PAUSE = 9000;
    /* Node centres as a percentage of the ring box: radius 37.5% at 60
       degree steps, starting at twelve o'clock. */
    var POS = [[50, 12.5], [82.5, 31.25], [82.5, 68.75], [50, 87.5], [17.5, 68.75], [17.5, 31.25]];

    mounts.forEach(function (mount) { build(mount); });

    function read(link) {
      var cellTag  = link.querySelector('.cell__tag');
      var rowTag   = link.querySelector('.index-row__tag');
      var heading  = link.querySelector('h3, h4');
      var desc     = link.querySelector('p');
      var name, title;

      if (cellTag) {            /* .cell: tag is the module name */
        name  = cellTag.textContent.trim();
        title = heading ? heading.textContent.trim() : '';
      } else if (rowTag) {      /* .index-row: heading is the module name */
        name  = heading ? heading.textContent.trim() : '';
        title = rowTag.textContent.trim();
      } else {
        name  = heading ? heading.textContent.trim() : '';
        title = '';
      }
      return {
        name:  name,
        /* "MAPP EYE" -> "EYE" for the ring, which has no room for both. */
        short: name.replace(/^MAPP\s+/i, ''),
        title: title,
        desc:  desc ? desc.textContent.trim() : '',
        href:  link.getAttribute('href') || ''
      };
    }

    function build(mount) {
      /* The source list is normally inside the mount, but data-orbit can
         name one elsewhere on the page. /mapp/ uses that: the orbit sits
         below the hero and reads the module index further down, so the
         six modules exist in the markup once, not twice. */
      var sel = mount.getAttribute("data-orbit");
      var external = !!sel;
      var src = external ? document.querySelector(sel) : mount.querySelector(".orbit__src");
      if (!src) return;
      var links = $$('a[href]', src);
      if (links.length !== 6) return;   /* the ring geometry is six-sided */

      var mods = links.map(read);
      if (mods.some(function (m) { return !m.name || !m.href; })) return;

      var stage = mount.querySelector('.orbit__stage');
      var ring  = mount.querySelector('.orbit__ring');
      var body  = mount.querySelector('.orbit__body');
      var dotsW = mount.querySelector('.orbit__dots');
      if (!stage || !ring || !body || !dotsW) return;

      var active = 0, pausedUntil = 0, inView = false, timer = null;
      var spokes = $$('line', ring);

      var nodes = mods.map(function (m, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'orbit__node';
        b.style.left = POS[i][0] + '%';
        b.style.top  = POS[i][1] + '%';
        /* Only the short name goes on the ring. The reference had a separate
           short tag per module ("EYE / OEE"); this site only has the full
           title, and "Performance Monitoring" wraps to two lines while
           "Track & Trace" takes one - which made the six nodes different
           heights and the ring visibly ragged. The full title is in the
           detail panel a few hundred pixels away, and in the aria-label. */
        var strong = document.createElement("b");
        strong.textContent = m.short;
        b.appendChild(strong);
        b.setAttribute('aria-label', m.name + (m.title ? ' — ' + m.title : ''));
        on(b, 'click', function () { select(i, true); });
        ring.appendChild(b);
        return b;
      });

      var dots = mods.map(function (m, i) {
        var d = document.createElement('button');
        d.type = 'button';
        d.setAttribute('aria-label', 'Show ' + m.name);
        on(d, 'click', function () { select(i, true); });
        dotsW.appendChild(d);
        return d;
      });

      function render() {
        var m = mods[active];
        nodes.forEach(function (n, i) { n.setAttribute('aria-pressed', String(i === active)); });
        dots.forEach(function (d, i) {
          if (i === active) d.setAttribute('aria-current', 'true');
          else d.removeAttribute('aria-current');
        });
        spokes.forEach(function (s, i) { s.classList.toggle('is-active', i === active); });

        /* Rebuilt rather than mutated so the fade-in replays each time.
           textContent throughout - this is page copy, not markup. */
        body.textContent = '';
        var k = document.createElement('p'); k.className = 'orbit__kicker'; k.textContent = m.name;
        var t = document.createElement('h3'); t.className = 'orbit__title'; t.textContent = m.title || m.name;
        var d = document.createElement('p'); d.className = 'orbit__desc'; d.textContent = m.desc;
        var a = document.createElement('a'); a.className = 'orbit__link'; a.href = m.href;
        a.textContent = 'Explore ' + m.name + ' ';
        a.insertAdjacentHTML('beforeend',
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
          '<path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" ' +
          'stroke-linecap="round" stroke-linejoin="round"/></svg>');
        body.appendChild(k); body.appendChild(t); body.appendChild(d); body.appendChild(a);
      }

      function running() {
        return inView && !document.hidden && Date.now() >= pausedUntil && !prefersReduced();
      }
      function tick() {
        timer = null;
        if (!running()) return;
        active = (active + 1) % mods.length;
        render();
        schedule();
      }
      function schedule() {
        /* Idempotent on purpose. This is called from scroll and resize, and
           the old body cleared the pending timer and started a fresh
           full-length one every time - so while the page was being scrolled
           the countdown never finished and nothing advanced. Measured: six
           seconds of scrolling, zero moves. Stop a countdown when the
           component should not be running, but never restart one that is
           already ticking. */
        if (!running()) { if (timer) { window.clearTimeout(timer); timer = null; } return; }
        if (timer) return;
        timer = window.setTimeout(tick, CYCLE);
      }
      function select(i, byUser) {
        active = i;
        if (byUser) pausedUntil = Date.now() + PAUSE;
        render();
        schedule();
        if (byUser) window.setTimeout(schedule, PAUSE + 60);
      }

      render();
      /* Only hide the list when it lives inside this component. An external
         one is a section in its own right and stays visible. */
      if (!external) mount.setAttribute("data-orbit-ready", "");
      else mount.classList.add("orbit--external");

      /* Geometry as well as the observer: IntersectionObserver callbacks are
         deferred while a document is hidden, so a page opened in a
         background tab would come back to a ring that never started. */
      function measure() {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var r = ring.getBoundingClientRect();
        var seen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        inView = r.height > 0 && (seen / r.height) > 0.3;
      }
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { inView = e.isIntersecting; });
          schedule();
        }, { threshold: 0.3 }).observe(ring);
      }
      var again = throttle(function () { measure(); schedule(); }, 150);
      on(window, 'scroll', again, { passive: true });
      on(window, 'resize', again, { passive: true });
      on(document, 'visibilitychange', schedule);
      if (reduceMotion.addEventListener) on(reduceMotion, 'change', schedule);
      measure();
      schedule();
    }
  }

  function initMisc() {
    // Year stamp
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    // Safe external links
    $$('a[href^="http"]').forEach(function (a) {
      if (a.hostname && a.hostname !== window.location.hostname) {
        a.setAttribute('rel', 'noopener noreferrer');
        if (!a.hasAttribute('target')) a.setAttribute('target', '_blank');
      }
    });

    // Back to top
    var top = $('[data-scroll-top]');
    on(top, 'click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------------------
     Link prefetch.

     Every internal link here is a full document load, so the browser starts
     cold on each click. Warming the next document while the pointer rests on
     a link - the couple of hundred milliseconds before the button actually
     goes down - turns most navigations into a cache hit, and the click reads
     as instant rather than merely quick.

     Deliberately conservative. Same-origin documents only, one attempt per
     URL for the life of the page, and nothing at all when the reader has
     asked to save data or is on a 2g connection, where speculative traffic
     spends their money on a page they may never open.
     ---------------------------------------------------------------------- */
  function initPrefetch() {
    var probe = document.createElement('link');
    if (!probe.relList || !probe.relList.supports || !probe.relList.supports('prefetch')) return;
    if (!document.body || !document.body.closest) return;

    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;

    var seen  = {};
    var timer = null;
    var here  = window.location.origin + window.location.pathname;

    function warm(href) {
      if (seen[href]) return;
      seen[href] = true;
      var link = document.createElement('link');
      link.rel  = 'prefetch';
      link.as   = 'document';
      link.href = href;
      document.head.appendChild(link);
    }

    /* The document this link would load, or null if fetching it early would
       be wrong: off-site, a download, a new tab, or the page already open. */
    function target(el) {
      var a = el && el.closest ? el.closest('a[href]') : null;
      if (!a || !a.href) return null;
      if (a.protocol !== 'http:' && a.protocol !== 'https:') return null;
      if (a.hostname !== window.location.hostname) return null;
      if (a.hasAttribute('download')) return null;
      if (a.target && a.target !== '' && a.target !== '_self') return null;
      if (a.origin + a.pathname === here) return null;
      return a.href.split('#')[0];
    }

    /* A pointer crossing a link on its way elsewhere is not intent, so the
       fetch waits for the cursor to actually settle. */
    on(document, 'pointerover', function (e) {
      var href = target(e.target);
      if (!href) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { warm(href); }, 70);
    }, { passive: true });

    on(document, 'pointerout', function () { window.clearTimeout(timer); }, { passive: true });

    /* Touch has no hover to read, so the press itself is the signal - still
       worth it, since the gap to touchend covers most of the round trip. */
    on(document, 'touchstart', function (e) {
      var href = target(e.target);
      if (href) warm(href);
    }, { passive: true });
  }

  /* ========================================================================
     BOOT
     ==================================================================== */

  /* ------------------------------------------------------------------------
     World map for the brand intro.

     An equirectangular land mask, 180x71 cells covering 84N to 58S, packed one
     bit per cell into base64. The north edge reaches 84 rather than 78 so
     Greenland finishes inside the frame - cropped at 78 its top row sat flush
     against the edge and the continent read as sliced off. Antarctica is outside that band on purpose: it
     adds a stripe along the bottom that reads as a rule, not a continent.

     Built from continent outlines and checked against eighty known
     coordinates - cities that must land on ground, open ocean that must not -
     so the shapes are verified rather than eyeballed.
     ---------------------------------------------------------------------- */
  var PL_MAP_COLS = 180, PL_MAP_ROWS = 71;
  var PL_MAP_BITS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/+AAAAAAAAAAAAAAAAAAAAAAAAAAAf//AAAAAAAAAAAAAAAAAAAAAAAAAAA///wAAAAAAAAAeAAAAAAAAAAAAAAAA///4AAAAAAAB//wAAAAAAAAAAAAAAAf//wAAAAAAAP///4AAAAAAAAAAAAAAP//wAAAAAAB//////4AA8D/////4AAH//gAAH+AP////////8A+f//////AAD/8AAA//n//////////w8///////gAB/w+AA8/////////////Af/////wQAA+AAAB8/////////////AP/////gPwAYAAAH8////////////4AH/////gH8AAAAAH7////////////AADAB///4H+AAAACDz/////////+D8AAAAA///+P/AAAALDD/////////+D4AAAAAf///P/gAAAbn//////////8BwAAAAAP/////wAAAH///////////8AAAAAAAH/////gAAAB///////////4AAAAAAAD/////AAAAB////P//////wAAAAAAAD////4AAAAD/fwHP//////iAAAAAAAD////wAAAAfhnwHv//////DAAAAAAAD////AAAAAfCb//v/////+CAAAAAAAD///+AAAAAfCD//n/////8CAAAAAAAB///8AAAAAOAQH///////sGAAAAAAAA///8AAAAAH/gA///////k8AAAAAAAAf//wAAAAAP/4B///////hAAAAAAAAAP//gAAAAAf//9///////gAAAAAAAAAD/4QAAAAA///+/P/////AAAAAAAAAAB/AQAAAAB///+/3/////AAAAAAAAAAA+AAAAAAB///+/+H///+AAAAAAAAAAAeAgAAAAB////f/D///8AAAAAAAAAAAf4EAAAAD////f8B/n/AAAAAAAAAAAAP8BwAAAD////P4A/D/AAAAAAAAAAAAD8AAAAAD////nwA+A/AgAAAAAAAAAAAOAAAAAH////zAA8AfAwAAAAAAAAAAADAAAAAD////6AAcAeAwAAAAAAAAAAABw4AAAD/////gAMAeA4AAAAAAAAAAAA7/AAAB/////gAIAcAwAAAAAAAAAAAAH/gAAA/////AACAcAAAAAAAAAAAAAAH/wAAAYP///AAABMAAAAAAAAAAAAAAH/4AAAAB//+AAABkOAAAAAAAAAAAAAH/8AAAAB//8AAAAw+AAAAAAAAAAAAAP//AAAAB//4AAAAYewAAAAAAAAAAAAP//4AAAB//wAAAAMcx+AAAAAAAAAAAP//+AAAA//wAAAAGBA/gAAAAAAAAAAP///AAAA//wAAAABwAPwAAAAAAAAAAP///AAAA//wAAAAAAAB4AAAAAAAAAAH///AAAA//wAAAAAAAAAAAAAAAAAAAD//+AAAA//wgAAAAABxAAAAAAAAAAAB//+AAAA//xgAAAAAHzgAAAAAAAAAAA//8AAAAf/zgAAAAAP/gAAAAAAAAAAAf/8AAAAf/jgAAAAA//wAAAAAAAAAAAf/4AAAAf/jgAAAAD//4AAAAAAAAAAAf/4AAAAf/DAAAAAH//8AAAAAAAAAAAf/AAAAAf+DAAAAAH//8AAAAAAAAAAAf+AAAAAf8AAAAAAH//+AAAAAAAAAAA/+AAAAAP8AAAAAAH//+AAAAAAAAAAA/8AAAAAP4AAAAAAD//8AAAAAAAAAAA/4AAAAAHwAAAAAADwf8AAAAAAAAAAA/gAAAAAAAAAAAAAAAH8AIAAAAAAAAB/AAAAAAAAAAAAAAAAD4AOAAAAAAAAB+AAAAAAAAAAAAAAAAAAAOAAAAAAAAB8AAAAAAAAAAAAAAAAAwAMAAAAAAAAB8AAAAAAAAAAAAAAAAAwAQAAAAAAAAB4AAAAAAAAAAAAAAAAAABgAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  var plMask = null;

  function plDecodeMask() {
    if (plMask) return plMask;
    try {
      var bin = window.atob(PL_MAP_BITS), n = PL_MAP_COLS * PL_MAP_ROWS;
      var out = new Uint8Array(n);
      for (var i = 0; i < n; i++) {
        out[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
      }
      plMask = out;
    } catch (e) { plMask = new Uint8Array(0); }
    return plMask;
  }

  function plPaintMap(canvas) {
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    var mask = plDecodeMask();
    if (!mask.length) return;

    var rect = canvas.getBoundingClientRect();
    var w = Math.max(rect.width, 1), h = Math.max(rect.height, 1);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var light = document.documentElement.getAttribute('data-theme') === 'light';
    var rgb = getComputedStyle(document.documentElement)
                .getPropertyValue('--pl-dot').trim() || (light ? '15,23,42' : '190,205,240');
    var base = light ? 0.22 : 0.30;

    /* Dots are spaced by pixels, not by grid cells. On a phone the full 180
       columns would land sub-pixel and smear into a grey wash, so the grid is
       sampled down until the spacing is comfortable. */
    var across = Math.max(56, Math.min(PL_MAP_COLS, Math.floor(w / 4.2)));
    var down   = Math.max(20, Math.round(across * PL_MAP_ROWS / PL_MAP_COLS));
    var sx = w / across, sy = h / down;
    var r = Math.max(0.8, Math.min(sx, sy) * 0.26);

    for (var y = 0; y < down; y++) {
      var gy = Math.min(PL_MAP_ROWS - 1, Math.floor(y * PL_MAP_ROWS / down));
      /* soft vignette over the outer eighth so the map never hits a hard edge */
      var fy = Math.min(1, Math.min(y, down - 1 - y) / (down * 0.12));
      for (var x = 0; x < across; x++) {
        var gx = Math.min(PL_MAP_COLS - 1, Math.floor(x * PL_MAP_COLS / across));
        if (!mask[gy * PL_MAP_COLS + gx]) continue;
        var fx = Math.min(1, Math.min(x, across - 1 - x) / (across * 0.12));
        var f = Math.min(fx, fy);
        f = f < 1 ? f * f * (3 - 2 * f) : 1;
        if (f <= 0.01) continue;
        ctx.fillStyle = 'rgba(' + rgb + ',' + (base * f).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc((x + 0.5) * sx, (y + 0.5) * sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ------------------------------------------------------------------------
     Brand intro.

     Held open until three things are true: the webfont has settled (so the
     wordmark never re-shapes mid-fill), the fill has had time to run, and the
     page has finished loading. A hard cap closes it regardless, because an
     overlay that waits on a slow asset is a broken site, not a slow one.

     Only the first page of a visit gets it. Every internal link here is a
     full document load, so without the sessionStorage flag a reader would sit
     through the intro on every single click.
     ---------------------------------------------------------------------- */
  function initPreloader() {
    var el = document.getElementById('preloader');
    if (!el) return;

    var root = document.documentElement;

    /* Already seen this visit - the inline bootstrap has hidden it, so just
       drop it out of the document. */
    if (root.classList.contains('pl-done')) {
      if (el.parentNode) el.parentNode.removeChild(el);
      return;
    }

    var map = el.querySelector('.preloader__map');
    if (map) {
      plPaintMap(map);
      /* Orientation changes mid-intro, and the theme can flip underneath it. */
      var repaint = rafThrottle(function () { if (map.parentNode) plPaintMap(map); });
      on(window, 'resize', repaint, { passive: true });
      on(window, 'kneo:theme', repaint);
    }

    var reduced  = prefersReduced();
    var MIN_HOLD = reduced ? 320 : 2800;   /* .25s delay + 2.4s rise + a
                                              beat, measured from the reveal
                                              rather than from navigation:
                                              the font may land at any point.
                                              Track pl-rise in main.css - a
                                              hold shorter than the animation
                                              cuts the fill off mid-climb. */
    var CAP      = 5000;
    var closed   = false, loaded = false, held = false, revealed = false;

    function close() {
      if (closed) return;
      closed = true;
      window.clearTimeout(capTimer);
      try { sessionStorage.setItem('kneo-intro', '1'); } catch (e) {}
      root.classList.add('pl-done');
      el.classList.add('is-out');
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        /* the hero canvas and any observer that measured while the overlay
           was up gets a chance to re-measure */
        try { window.dispatchEvent(new Event('resize')); } catch (e) {}
      }, 650);
    }

    function maybeClose() { if (loaded && held) close(); }

    function reveal() {
      if (revealed) return;
      revealed = true;
      el.classList.add('is-ready');
      window.setTimeout(function () { held = true; maybeClose(); }, MIN_HOLD);
    }

    var capTimer = window.setTimeout(close, CAP);

    /* document.fonts.ready can sit unresolved behind a blocked font host, so
       it is raced against a timer rather than trusted outright. */
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(reveal, reveal);
      window.setTimeout(reveal, 1200);
    } else {
      reveal();
    }

    if (document.readyState === 'complete') { loaded = true; maybeClose(); }
    else on(window, 'load', function () { loaded = true; maybeClose(); });
  }

  /* --------------------------------------------------------------------------
     COOKIE CONSENT

     The banner is a real gate, not decoration. Nothing that needs consent may
     be loaded directly: it registers through the hook and is held until the
     visitor accepts.

         kneoConsent.onGrant(function () {
           // e.g. inject the analytics tag here
         });

     onGrant fires immediately when consent was given on an earlier visit, so
     callers never have to ask which case they are in. Decline therefore blocks
     by construction rather than by remembering to check a flag.

     What the site stores today needs no consent at all — a theme preference
     and an intro-played flag, both set at the visitor's own request — which is
     why the banner's wording promises nothing beyond that. When analytics is
     added, register it above and the wording is already true.

     The choice is versioned: bump VERSION to re-ask everyone, which is what a
     change in what we collect requires.
     -------------------------------------------------------------------------- */
  function initCookieConsent() {
    var STORE = 'kneo-consent';
    /* Bumped to 2: the notice moved and changed shape, and anyone who answered
       the previous one - including while testing - would otherwise never see
       it again, because a stored choice is correctly permanent. A version bump
       is exactly the mechanism for re-asking, and it costs a returning visitor
       one dismissal. */
    var VERSION = 2;
    var waiting = [];
    var state = null;

    function read() {
      try {
        var raw = window.localStorage.getItem(STORE);
        if (!raw) return null;
        var v = JSON.parse(raw);
        if (!v || v.v !== VERSION) return null;        // asked under different terms
        return (v.state === 'granted' || v.state === 'denied') ? v.state : null;
      } catch (e) { return null; }
    }

    function write(next) {
      try {
        window.localStorage.setItem(STORE, JSON.stringify({
          v: VERSION, state: next, at: new Date().toISOString()
        }));
      } catch (e) {}                                    // private mode: choice holds for this page only
    }

    function release() {
      // Drain rather than iterate: a callback must not be able to run twice.
      var fns = waiting; waiting = [];
      fns.forEach(function (fn) { try { fn(); } catch (e) {} });
    }

    state = read();

    // Published before the early return below, so a page without the banner
    // markup still gets a usable, honest API instead of a crash.
    window.kneoConsent = {
      state: function () { return state; },
      granted: function () { return state === 'granted'; },
      onGrant: function (fn) {
        if (typeof fn !== 'function') return;
        if (state === 'granted') { try { fn(); } catch (e) {} }
        else waiting.push(fn);
      },
      revoke: function () {
        try { window.localStorage.removeItem(STORE); } catch (e) {}
        state = null;
        show();
      }
    };

    var el = $('[data-cc]');
    if (!el) { if (state === 'granted') release(); return; }

    var shown = false, lastFocus = null;

    function show() {
      if (shown) return;
      shown = true;
      lastFocus = document.activeElement;
      el.hidden = false;
      // Reading a layout property flushes style and layout, which gives the
      // transition a start value to move from. Deliberately NOT a pair of
      // requestAnimationFrame calls: rAF is suspended while a document is
      // hidden, so a tab opened in the background would leave the notice
      // un-revealed until it was looked at. This runs in the same task.
      void el.offsetWidth;
      el.classList.add('is-in');
      /* Deliberately does NOT take focus. This sits alongside the page rather
         than over it, and pulling focus out of whatever someone is reading,
         seconds after it loads, is hostile. It is a labelled landmark, so a
         screen reader can reach it on demand. */
    }

    function hide() {
      el.classList.remove('is-in');
      el.classList.add('is-out');
      var gone = function () { el.hidden = true; el.classList.remove('is-out'); shown = false; };
      if (prefersReduced()) { gone(); } else { window.setTimeout(gone, 300); }
      // Back where they were. Returning focus to the body would drop a
      // keyboard user at the top of the document.
      if (lastFocus && lastFocus.focus) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
      }
      lastFocus = null;
    }

    /* Escape, while focus is inside the notice, does what the close control
       does: decline. Dismissing is never consent. No focus trap - nothing is
       trapped behind a notice that does not cover the page. */
    on(el, 'keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); decide('denied'); }
    });

    function decide(next) {
      state = next;
      write(next);
      hide();
      try {
        window.localStorage.setItem('kneo_cookie_consent', next);
      } catch (e) {}

      // Mirror deployed Next.js app GTM consent integration
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          'ad_storage': next,
          'ad_user_data': next,
          'ad_personalization': next,
          'analytics_storage': next
        });
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'cookie_consent_update',
        consent: next
      });

      if (next === 'granted') {
        release();
        window.dispatchEvent(new Event('kneo_consent_granted'));
      }
      window.dispatchEvent(new CustomEvent('kneo:consent', { detail: { state: next } }));
    }

    $$('[data-cc-accept]', el).forEach(function (b) {
      on(b, 'click', function () { decide('granted'); });
    });
    // The close control is bound here too: dismissing is never consent.
    $$('[data-cc-decline]', el).forEach(function (b) {
      on(b, 'click', function () { decide('denied'); });
    });

    // Lets a "Cookie settings" link anywhere re-open the choice, which is what
    // withdrawing consent needs to be as easy as giving it.
    $$('[data-cc-open]').forEach(function (b) {
      on(b, 'click', function (e) { e.preventDefault(); window.kneoConsent.revoke(); });
    });

    if (state !== null) {
      if (state === 'granted') release();
      return;
    }

    /* Opens WITH the page rather than on a timer. The old fixed delay was
       wrong in both directions: too late on a repeat visit, where the intro
       is skipped and the page is already there, and still too early on a
       cold load, where the preloader (z-index 9999) was covering it anyway.

       The preloader puts pl-done on <html> the moment it starts clearing, so
       the notice rises as the page is revealed. If the intro was already seen
       this session the class is there before we are, and it shows at once. */
    var root = document.documentElement;
    if (!document.getElementById('preloader') || root.classList.contains('pl-done')) {
      show();
    } else if (window.MutationObserver) {
      var mo = new MutationObserver(function () {
        if (!root.classList.contains('pl-done')) return;
        mo.disconnect();
        show();
      });
      mo.observe(root, { attributes: true, attributeFilter: ['class'] });
      // The preloader caps itself at 5s; never outlive that cap.
      window.setTimeout(function () { mo.disconnect(); show(); }, 5600);
    } else {
      window.setTimeout(show, 1200);
    }
  }

  function boot() {
    try { initPreloader(); }  catch (e) {}
    try { initTheme(); }       catch (e) {}
    try { initHeader(); }      catch (e) {}
    try { initNav(); }         catch (e) {}
    try { initSplitText(); }   catch (e) {}
    // After the splitter, which rebuilds the headline it lives inside.
    try { initWordCycle(); }   catch (e) {}
    try { initProseCadence(); } catch (e) {}
    try { initMediaReveal(); } catch (e) {}
    try { initReveal(); }      catch (e) {}
    try { initMappOrbit(); }  catch (e) {}
    try { initStepFlow(); }   catch (e) {}
    try { initWhatWeDo(); }   catch (e) {}
    try { initAutoBalloon(); } catch (e) {}
    try { initZenDoneOnce(); } catch (e) {}
    try { initIndustryStrip(); } catch (e) {}
    try { initPfmea(); }        catch (e) {}
    try { initSolveRing(); }   catch (e) {}
    try { initCertCard(); }    catch (e) {}
    try { initSolveStrip(); }  catch (e) {}
    try { initWorldMap(); }   catch (e) {}
    try { initSheen(); }      catch (e) {}
    try { initCounters(); }    catch (e) {}
    try { initAccordions(); }  catch (e) {}
    try { initTabs(); }        catch (e) {}
    try { initScrollspy(); }   catch (e) {}
    try { initParallax(); }    catch (e) {}
    try { initHeroBackdrops(); } catch (e) {}
    try { initHeroCanvas(); }  catch (e) {}
    try { initHeroPointer(); } catch (e) {}
    try { initCtaPointer(); }  catch (e) {}
    try { initHeroVideo(); }   catch (e) {}
    try { initScrollStart(); } catch (e) {}
    try { initForms(); }       catch (e) {}
    try { initEnquiryRouting(); } catch (e) {}
    try { initMisc(); }        catch (e) {}
    try { initCookieConsent(); } catch (e) {}
    try { initPrefetch(); }    catch (e) {}
    document.documentElement.classList.add('js-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
