/* ════════════════════════════════════════════════════════════════════
   Urban Environmental — logo intro ("sucking wind" reveal)
   ════════════════════════════════════════════════════════════════════
   Used on index.html only. Loaded *synchronously* in <head> (it is small)
   so it can cover the page before anything is painted. Styles are in the
   "LOGO INTRO" block at the end of styles.css. Overview + tweaking guide:
   INTRO-README.md.

   WHAT THE VISITOR SEES (times in ms from when the overlay appears)
     0    – 1150  WIND   Streaks of air spiral in from beyond the screen
                         edges and get sucked into the UE logo, which
                         slowly "inhales" (grows from 15% to 55%).
     1080 – 1450  POP    The logo springs to full size with a small
                         overshoot; a ring ripples out and the halo flares.
     1450 – ...   IDLE   The logo stays, breathing very gently, with a
                         faint ongoing breeze. At 1650 a "Click to enter" /
                         "Tap to enter" button fades in.
     on dismiss   LEAVE  Click / tap anywhere, or press Enter, Space or
                         Escape (works at any point, even mid-wind) →
                         the overlay fades out over 0.4s and is removed.

   WHEN IT SHOWS
     - Once per browser tab session (sessionStorage "ueIntroSeen").
     - Not when the page is opened in a background tab.
     - ?intro=1 in the URL forces it; ?intro=0 disables it (for testing).

   THEME
     Follows the site's own toggle: scripts.js stores localStorage
     "theme" = "dark" and adds body.dark. We read the same flag here.

   REDUCED MOTION
     If the OS asks for reduced motion, no particles/scaling: the logo and
     button just fade in and wait for a click/key, then fade out.

   SAFETY (it must never lock people out of the page)
     - The pre-paint cover hides itself after 4s by CSS alone, even if this
       script crashes.
     - If the DOM takes longer than 3.5s to be ready, the intro is skipped.
     - Any error while building/starting removes the overlay immediately.
     - It doesn't touch scripts.js, the theme toggle or the subscribe form.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;          // <html>
  var KEY = "ueIntroSeen";                 // sessionStorage key
  var LOGO_SRC = "UELogo-removebg-preview.png";

  /* ── Colours ────────────────────────────────────────────────────────
     Sampled from UELogo-removebg-preview.png, which is one colour:
     #D8EBFC = hsl(208°, 86%, 92%). Everything here is that same 208° hue
     at different lightness, so the wind matches the logo. Each entry is
     an "r,g,b" string; alpha is added per streak. Streaks pick "main" or
     (35% of the time) "alt". In light mode the logo colour itself would be
     invisible on the pale background, so deeper tints of it are used. */
  var PALETTE = {
    light: {
      main: "144,186,223",   // #90BADF  mid tint of the logo blue
      alt:  "102,156,204",   // #669CCC  deeper tint
      ring: "102,156,204"    // #669CCC
    },
    dark: {
      main: "216,235,252",   // #D8EBFC  the logo colour itself
      alt:  "144,186,223",   // #90BADF  mid tint
      ring: "216,235,252"    // #D8EBFC
    }
  };

  /* sessionStorage can throw (private mode, blocked storage) → swallow. */
  function store(method, value) {
    try {
      return method === "get" ? sessionStorage.getItem(KEY) : sessionStorage.setItem(KEY, value);
    } catch (e) { return null; }
  }

  /* ── Should we show it at all? ─────────────────────────────────────── */
  var force = /[?&]intro=1\b/.test(location.search);
  var never = /[?&]intro=0\b/.test(location.search);
  if (never || (!force && store("get") === "1")) return;          // already seen this session
  if (doc.visibilityState === "hidden" && !force) return;         // opened in a background tab

  function mq(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }
  var reduced = mq("(prefers-reduced-motion: reduce)");
  var touch = mq("(hover: none) and (pointer: coarse)");          // phones/tablets → "Tap"

  // Same flag scripts.js uses for its theme toggle.
  var dark = false;
  try { dark = localStorage.getItem("theme") === "dark"; } catch (e) {}
  var COLORS = dark ? PALETTE.dark : PALETTE.light;

  var bootAt = Date.now();
  var SLOW_LOAD_MS = 3500;   // if the DOM isn't ready by then, skip the intro

  // Turn on the instant CSS cover (html.ue-intro-pending::before) right
  // now, from <head>, so the page is never seen before the overlay.
  root.classList.add("ue-intro-pending");
  if (dark) root.classList.add("ue-intro-dark");
  store("set", "1");         // mark as seen up front so a reload won't replay

  /* ── Timeline (ms) – tweak these to change the pacing ──────────────── */
  var T_WIND_END = 1150;     // every intro streak has been sucked in by now
  var T_POP = 1080;          // logo starts its pop
  var T_POP_END = 1450;      // pop/overshoot finished, idle begins
  var T_HINT = 1650;         // "Click to enter" appears
  var T_REDUCED_HINT = 500;  // reduced motion: when the button appears

  /* ── Particle amounts – tweak for more/less wind ───────────────────── */
  var AREA_PER_STREAK = 8000;      // one streak per 8000 px² of screen…
  var MIN_STREAKS = 70, MAX_STREAKS = 170;   // …clamped to this range
  var IDLE_SHARE = 0.22;           // idle breeze = 22% of that (16–36 streaks)

  // DOM nodes and run-time state.
  var overlay, canvas, ctx, logo, glow, enterBtn, rafId, t0 = 0, finished = false;
  var hintTimer, inerted = [], hintShown = false;
  var W = 0, H = 0, DPR = 1, CX = 0, CY = 0, LOGO_R = 100, MAX_R = 600;
  var particles = [], idle = [];

  /* ── Small maths helpers ───────────────────────────────────────────── */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }              // blend a→b by t (0..1)
  function rnd(a, b) { return lerp(a, b, Math.random()); }        // random number in [a,b)
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }     // fast start, soft end
  function easeInQuad(t) { return t * t; }                        // slow start, speeds up
  function smoothstep(a, b, t) { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  // "Back out" easing: goes past 1 (≈ +12% at s = 2.4) then settles → the pop.
  function backOut(t) { var s = 2.4; t -= 1; return t * t * ((s + 1) * t + s) + 1; }

  function onReady(fn) {
    if (doc.readyState !== "loading") fn();
    else doc.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  /* ══ BUILD THE OVERLAY ═════════════════════════════════════════════════
     <div class="ue-intro [is-dark] [ue-intro--reduced]" role="dialog">
       <canvas>                    wind streaks + pop ring (not in reduced)
       <div class="ue-intro__glow">  halo behind the logo  (not in reduced)
       <img class="ue-intro__logo">  the PNG, original colours
       <button class="ue-intro__enter">Click to enter</button>
     </div> */
  function build() {
    overlay = doc.createElement("div");
    overlay.className = "ue-intro" + (dark ? " is-dark" : "") + (reduced ? " ue-intro--reduced" : "");
    // A modal dialog for screen readers; its only control is the button.
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Urban Environmental");
    if (!reduced) {
      canvas = doc.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      overlay.appendChild(canvas);
      glow = doc.createElement("div");
      glow.className = "ue-intro__glow";
      glow.setAttribute("aria-hidden", "true");
      overlay.appendChild(glow);
    }
    logo = doc.createElement("img");
    logo.className = "ue-intro__logo";
    logo.src = LOGO_SRC;
    logo.alt = "Urban Environmental logo";
    logo.decoding = "async";
    overlay.appendChild(logo);

    enterBtn = doc.createElement("button");
    enterBtn.type = "button";
    enterBtn.className = "ue-intro__enter";
    enterBtn.textContent = touch ? "Tap to enter" : "Click to enter";
    overlay.appendChild(enterBtn);

    doc.body.appendChild(overlay);

    // Make the page behind "inert" (not clickable/tabbable/readable) and
    // stop it scrolling while the intro is up. Undone in cleanupPage().
    Array.prototype.forEach.call(doc.body.children, function (el) {
      if (el !== overlay && el.tagName !== "SCRIPT" && !el.hasAttribute("inert")) {
        el.setAttribute("inert", "");
        inerted.push(el);
      }
    });
    root.classList.add("ue-intro-lock");

    // Dismissal: a click/tap anywhere on the overlay (the button included,
    // via bubbling) or the keys handled in onKey().
    overlay.addEventListener("click", dismiss);
    doc.addEventListener("keydown", onKey, true);
    focusEnter();

    // The real overlay now covers the page; drop the pre-paint cover.
    root.classList.remove("ue-intro-pending", "ue-intro-dark");
  }

  function focusEnter() {
    try { enterBtn.focus({ preventScroll: true }); } catch (e) { enterBtn.focus(); }
  }

  function showHint() {
    if (hintShown || !enterBtn) return;
    hintShown = true;
    enterBtn.classList.add("is-shown");   // CSS fades it in and starts the pulse
  }

  /* ══ DISMISSAL ═════════════════════════════════════════════════════════
     Enter / Space / Escape close it. Tab is kept on the button (the dialog
     has a single control) so keyboard focus can't wander behind it. */
  function onKey(e) {
    if (finished) return;
    var k = e.key;
    if (k === "Enter" || k === " " || k === "Spacebar" || k === "Escape" || k === "Esc") {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    } else if (k === "Tab") {
      e.preventDefault();
      focusEnter();
    }
  }

  function dismiss() { finish(); }

  // Give the page back: remove inert, scroll lock, cover classes, key handler.
  function cleanupPage() {
    doc.removeEventListener("keydown", onKey, true);
    inerted.forEach(function (el) { el.removeAttribute("inert"); });
    inerted = [];
    root.classList.remove("ue-intro-lock", "ue-intro-pending", "ue-intro-dark");
  }

  // immediate = true → remove at once with no fade (used on errors).
  function finish(immediate) {
    if (finished) return;
    finished = true;
    clearTimeout(hintTimer);
    cleanupPage();
    if (!overlay) return;
    // Keyboard users continue from the main content, without scrolling.
    var main = doc.querySelector("main");
    if (main) {
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
      try { main.focus({ preventScroll: true }); } catch (e) {}
    }
    var remove = function () {
      cancelAnimationFrame(rafId);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = canvas = ctx = enterBtn = null;
      particles = []; idle = [];
    };
    if (immediate) { remove(); return; }
    overlay.classList.add("is-leaving");  // CSS: 0.4s opacity fade
    setTimeout(remove, 450);              // then take it out of the DOM
  }

  /* ══ CANVAS + PARTICLES ════════════════════════════════════════════════ */

  // Size the canvas to the window (sharp on retina, DPR capped at 2 for
  // speed) and work out the centre and the logo's radius.
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    CX = W / 2; CY = H / 2;
    MAX_R = Math.hypot(W, H) / 2;          // centre → corner distance
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    LOGO_R = (logo.offsetWidth || 200) / 2;
  }

  /* One streak of air. It travels along a spiral from radius r0 (outside
     the screen) to r1 (inside the logo), starting at time `start` and
     taking `life` ms. */
  function newParticle(start, life, alphaScale) {
    var isDot = Math.random() < 0.28;     // ~28% are short "dust" dashes
    return {
      a0: Math.random() * Math.PI * 2,    // starting angle around the logo
      r0: MAX_R * rnd(0.7, 1.2),          // starting distance (mostly off-screen)
      r1: LOGO_R * rnd(0.05, 0.45),       // where it vanishes, inside the logo
      spin: rnd(1.3, 2.6),                // radians turned on the way in (clockwise vortex)
      start: start,
      life: life,
      dot: isDot,
      width: isDot ? rnd(1.4, 2.6) : rnd(0.8, 2.2),   // line thickness (px)
      alpha: rnd(0.35, 0.9) * alphaScale,             // peak opacity
      alt: Math.random() < 0.35           // use the palette's alternate shade
    };
  }

  function makeParticles() {
    // Intro wind: count scales with screen area.
    var n = clamp(Math.round((W * H) / AREA_PER_STREAK), MIN_STREAKS, MAX_STREAKS);
    for (var i = 0; i < n; i++) {
      var life = rnd(520, 950);
      // Start early enough to arrive by T_WIND_END; the power > 1 biases
      // starts towards the beginning so the wind builds then drains in.
      var start = (T_WIND_END - life) * Math.pow(Math.random(), 1.25);
      particles.push(newParticle(start, life, 1));
    }
    // Idle breeze: a few slow, faint (40% opacity) streaks, recycled forever.
    var m = clamp(Math.round(n * IDLE_SHARE), 16, 36);
    for (var j = 0; j < m; j++) {
      idle.push(newParticle(T_POP_END + rnd(0, 2400), rnd(1700, 2800), 0.4));
    }
  }

  /* Where is particle p at progress `prog` (0 = start, 1 = sucked in)?
     e = prog^2.1 makes it accelerate – slow drift far out, rushing in at
     the end, like air being pulled into an intake. The radius shrinks
     with e and the angle grows with e^1.2, so it curls tighter near the
     centre. The y-axis is squashed to 82% for a slight perspective look. */
  function pos(p, prog) {
    var e = Math.pow(prog, 2.1);
    var r = lerp(p.r0, p.r1, e);
    var a = p.a0 + p.spin * Math.pow(e, 1.2);
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r * 0.82];
  }

  function colour(p, a) {
    return "rgba(" + (p.alt ? COLORS.alt : COLORS.main) + "," + a + ")";
  }

  /* Draw one streak as a short curved line from where it was a moment ago
     (prog - trail) to where it is now. The trail lengthens as it speeds
     up, which is what sells the "rush" towards the logo. It fades in at
     the start, fades out as it disappears into the logo, and thins out. */
  function drawStreak(p, t) {
    var prog = (t - p.start) / p.life;
    if (prog <= 0 || prog >= 1) return;     // not started yet / already gone
    var e = Math.pow(prog, 2.1);
    var a = p.alpha * smoothstep(0, 0.18, prog) * (1 - smoothstep(0.82, 1, prog));
    if (a <= 0.01) return;
    var trail = p.dot ? 0.03 + 0.06 * e : 0.08 + 0.22 * e;
    var from = Math.max(0, prog - trail);
    var steps = 6;                           // 6 segments = smooth enough curve
    ctx.beginPath();
    for (var s = 0; s <= steps; s++) {
      var q = pos(p, lerp(from, prog, s / steps));
      if (s === 0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
    ctx.strokeStyle = colour(p, a.toFixed(3));
    ctx.lineWidth = p.width * (1 - 0.45 * e);
    ctx.stroke();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    // Dark mode: additive blending so overlapping streaks glow.
    ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    var i;
    // Intro wind streaks (skip the loop once they've all arrived).
    if (t < T_WIND_END + 50) {
      for (i = 0; i < particles.length; i++) drawStreak(particles[i], t);
    }
    // Idle breeze: when a streak finishes, replace it with a new one, so
    // there is always a gentle inflow while waiting for the click.
    for (i = 0; i < idle.length; i++) {
      var p = idle[i];
      if (t >= p.start + p.life) {
        idle[i] = p = newParticle(t + rnd(0, 600), rnd(1700, 2800), 0.4);
      }
      drawStreak(p, t);
    }

    // POP ring: an ellipse expanding from the logo outward over 520ms,
    // fading and thinning as it grows.
    var rp = (t - T_POP) / 520;
    if (rp > 0 && rp < 1) {
      var rr = LOGO_R * lerp(0.9, 2.6, easeOutCubic(rp));
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.ellipse(CX, CY, rr, rr * 0.82, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(" + COLORS.ring + "," + ((dark ? 0.5 : 0.45) * (1 - rp)).toFixed(3) + ")";
      ctx.lineWidth = lerp(3, 0.5, rp);
      ctx.stroke();
    }
  }

  /* ══ LOGO SCALE / OPACITY CURVE ════════════════════════════════════════
     Returns [scale, opacity] for time t. */
  function logoState(t) {
    if (t < T_POP) {
      // WIND – inhale: grows slowly (accelerating) from 15% to 55%,
      // fading in over the first 0.5s.
      var k = easeInQuad(clamp(t / T_POP, 0, 1));
      return [lerp(0.15, 0.55, k), clamp(t / 500, 0, 1) * 0.85];
    }
    if (t < T_POP_END) {
      // POP – 55% → 100% with an overshoot to ~112% (backOut), fully opaque.
      var k2 = (t - T_POP) / (T_POP_END - T_POP);
      return [lerp(0.55, 1, backOut(k2)), lerp(0.85, 1, clamp(k2 * 3, 0, 1))];
    }
    // IDLE – breathe ±1.8% on a 2.6s cycle, eased in over 0.6s.
    var b = Math.sin((t - T_POP_END) / 2600 * Math.PI * 2);
    return [1 + 0.018 * smoothstep(0, 600, t - T_POP_END) * b, 1];
  }

  /* ══ ANIMATION LOOP (one call per screen refresh) ══════════════════════ */
  function frame(now) {
    if (!overlay || finished && !overlay.classList.contains("is-leaving")) return;
    if (!t0) t0 = now;                       // time zero = first frame
    var t = now - t0;

    var ls = logoState(t);
    logo.style.transform = "scale(" + ls[0].toFixed(4) + ")";
    logo.style.opacity = ls[1].toFixed(3);

    // Halo: faint and small during the wind, flares to full on the pop,
    // relaxes to 35% and then pulses gently while idle.
    var g, gs;
    if (t < T_POP) {
      g = 0.25 * clamp(t / T_POP, 0, 1);
      gs = lerp(0.3, 0.6, t / T_POP);
    } else {
      var idleWave = 0.06 * Math.sin((t - T_POP) / 2600 * Math.PI * 2);
      g = lerp(1, 0.35, smoothstep(0, 1, (t - T_POP) / 600)) + idleWave * smoothstep(600, 1200, t - T_POP);
      gs = lerp(0.6, 1.25, easeOutCubic(clamp((t - T_POP) / 500, 0, 1)));
    }
    glow.style.opacity = g.toFixed(3);
    glow.style.transform = "translate(-50%,-50%) scale(" + gs.toFixed(3) + ")";

    draw(t);
    if (t >= T_HINT) showHint();

    // Keeps running while idle; browsers pause this in background tabs.
    rafId = requestAnimationFrame(frame);
  }

  /* ══ START ═════════════════════════════════════════════════════════════ */
  function start() {
    // Slow page? Don't add a splash on top of an already slow load.
    if (!force && Date.now() - bootAt > SLOW_LOAD_MS) { cleanupPage(); return; }
    try {
      build();
      if (reduced) {
        // Reduced motion: CSS fades the logo in; just show the button.
        hintTimer = setTimeout(showHint, T_REDUCED_HINT);
        return;
      }
      ctx = canvas.getContext("2d");
      if (!ctx) {
        // No canvas support: fall back to a static logo + button.
        canvas.remove();
        logo.style.opacity = 1; logo.style.transform = "none";
        hintTimer = setTimeout(showHint, T_REDUCED_HINT);
        return;
      }
      resize();
      makeParticles();
      window.addEventListener("resize", function () { if (ctx) resize(); }, { passive: true });
      rafId = requestAnimationFrame(frame);
    } catch (e) {
      // Never leave the page covered because of an intro bug.
      finish(true);
    }
  }

  onReady(start);
})();
