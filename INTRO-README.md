# Home page logo intro ("sucking wind")

A splash shown on **index.html** every time the page loads (including
refresh). Air streaks spiral into the UE logo, the logo pops, then it waits
for the visitor to click, tap or press a key before fading away to reveal the
site. There is no on-screen button or hint; the whole overlay is the control.

| File | What it holds |
|------|---------------|
| `intro.js` | All the behaviour: when to show it, the overlay, the canvas particles, timing, dismissal. Fully commented. |
| `styles.css` | The **LOGO INTRO** block at the end: overlay, logo, dark-mode glow, focus ring, light/dark colours, reduced motion, safety fallbacks. |
| `index.html` | One line in `<head>`: `<script src="intro.js"></script>` (after `styles.css`, before `scripts.js`). Remove it to turn the intro off. |
| `UELogo-removebg-preview.png` | The logo, shown in its original colours (not recoloured). |

## How it works

1. **Before the page paints:** `intro.js` runs in `<head>`. It works out whether
   to show the intro (not in a
   background tab) and adds `ue-intro-pending` to `<html>`. A CSS
   `::before` then covers the screen immediately, so the page never flashes.
2. **DOM ready:** it builds the overlay (`.ue-intro`), which holds a `<canvas>`
   for the wind, the logo `<img>` and, in dark mode only, a faint glow. The
   overlay itself is the control (`role="button"`, `tabindex="0"`,
   `aria-label="Enter site"`) and it gets focus straight away. The page behind
   is made `inert` and can't scroll.
3. **Animation loop** (`requestAnimationFrame`), times in ms:
   - **0–1150, wind:** 70–170 streaks start outside the screen and follow a
     spiral into the logo. Progress is eased with `prog^2.1`, so each streak
     drifts slowly at first and rushes in at the end. Its tail gets longer as
     it speeds up, and it curls tighter near the centre. The logo grows from
     15% to 55% as if breathing in.
   - **1080–1450, pop:** the logo springs to 100% with about 12% overshoot
     ("back-out" easing); in dark mode the glow flares. No ring or circle is
     drawn around the logo – the pop is just the scale-up.
   - **1450 onwards, idle:** the logo breathes ±1.8% and a faint breeze keeps
     flowing in (streaks are recycled) until it is dismissed.
4. **Dismissal:** a click or tap anywhere, or **Enter / Space / Escape**,
   fades the overlay out over 0.4s and removes it. Focus moves to `<main>`.
   It can be dismissed at any point, even mid-wind. Tab keeps focus on the
   overlay. A focus ring only appears after Tab is pressed (keyboard users),
   never for mouse, touch or the automatic focus.

**Theme:** follows the site's toggle (`localStorage.theme === "dark"`, the
same flag `scripts.js` uses for `body.dark`).
**Reduced motion:** with the OS "reduce motion" setting, there are no
particles or scaling. The logo fades in, then it waits for a click or key as
usual.
**Safety:** the CSS cover hides itself after 4s even if the JS fails. The
intro is skipped if the page takes more than 3.5s to load, and any error
removes the overlay. It doesn't touch `scripts.js`, the theme toggle or the
subscribe form.

## Testing

- `index.html?intro=1` forces it to play.
- `index.html?intro=0` disables it.

## Tweaking

**Timing** (`intro.js`, "Timeline"):
`T_WIND_END` (streaks all arrived), `T_POP` / `T_POP_END` (pop start/end;
idle starts at `T_POP_END`). The fade-out length is
`.ue-intro.is-leaving` in CSS (0.4s), plus the matching `setTimeout(remove, 450)`
in `finish()`.

**Amount of wind** (`intro.js`, "Particle amounts"):
`AREA_PER_STREAK` (lower means more streaks), `MIN_STREAKS` / `MAX_STREAKS`,
`IDLE_SHARE` (how strong the idle breeze is). For speed and swirl see
`newParticle()`: `life` (ms per streak), `spin` (radians of curl), `width`
and `alpha`.

**Colours.** The logo PNG is a single colour, `#D8EBFC`
(hsl 208°, 86%, 92%). Everything else is the same 208° hue:

| Use | Light mode | Dark mode |
|-----|-----------|-----------|
| Background | `#C4D2DE` soft blue-grey (hsl 208°, 28%, 82%) | `#111111` (site dark bg) |
| Logo | `#D8EBFC` (PNG as-is) + very subtle shadow `drop-shadow(0 6px 16px)` in `#315372` at 9%, no outline | `#D8EBFC` (PNG as-is) + subtle glow `drop-shadow(0 0 18px)` in `#D8EBFC` at 11% |
| Streaks (main / alt) | `#D8EBFC` / `#72A1CA` | `#D8EBFC` / `#90BADF` |
| Glow behind logo | none | `#D8EBFC` at 9% (peak, at the pop) |
| Keyboard focus ring | `#ECF5FE` | `#90BADF` |

**Brand rule:** the logo is always pale blue `#D8EBFC` in both modes. The
shadow and glow are `drop-shadow` filters that only paint around the
letters, and the logo's opacity is 1 from the pop onwards, so its rendered
colour is exactly `#D8EBFC`.

In light mode the logo stays visible mainly through colour: the blue-grey
background is a little darker than the pale logo, so the logo reads as a
lighter shape on it. If you want more contrast, darken `--ue-intro-bg` a
little (e.g. `#B9C8D5`). Keep it in the 208° hue so it still matches.

- Streak colours: `PALETTE` at the top of `intro.js`.
- Background, glow, logo filter, focus ring: the CSS variables in `.ue-intro`
  (light) and `.ue-intro.is-dark` (dark) in `styles.css`. The pre-paint cover
  uses the same background (`html.ue-intro-pending::before`, `html.ue-intro-dark`).

**Show once per session instead of every load:** add back a sessionStorage check (the `store()` helper is still in `intro.js`).
