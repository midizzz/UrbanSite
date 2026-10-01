# Home page logo intro ("sucking wind")

A splash shown on **index.html** once per browser session. Air streaks spiral
into the UE logo, the logo pops, then it waits for the visitor to click, tap
or press a key before fading away to reveal the site.

| File | What it holds |
|------|---------------|
| `intro.js` | All the behaviour: when to show it, the overlay, the canvas particles, timing, dismissal. Fully commented. |
| `styles.css` | The **LOGO INTRO** block at the end: overlay, logo, halo, button, light/dark colours, reduced motion, safety fallbacks. |
| `index.html` | One line in `<head>`: `<script src="intro.js"></script>` (after `styles.css`, before `scripts.js`). Remove it to turn the intro off. |
| `UELogo-removebg-preview.png` | The logo, shown in its original colours (not recoloured). |

## How it works

1. **Before the page paints:** `intro.js` runs in `<head>`. It works out whether
   to show the intro (not if it's already been seen this session, not in a
   background tab) and adds `ue-intro-pending` to `<html>`. A CSS
   `::before` then covers the screen immediately, so the page never flashes.
2. **DOM ready:** it builds the overlay (`.ue-intro`), which holds a `<canvas>`
   for the wind, a soft halo, the logo `<img>` and a "Click / Tap to enter"
   button. The page behind is made `inert` and can't scroll.
3. **Animation loop** (`requestAnimationFrame`), times in ms:
   - **0–1150, wind:** 70–170 streaks start outside the screen and follow a
     spiral into the logo. Progress is eased with `prog^2.1`, so each streak
     drifts slowly at first and rushes in at the end. Its tail gets longer as
     it speeds up, and it curls tighter near the centre. The logo grows from
     15% to 55% as if breathing in.
   - **1080–1450, pop:** the logo springs to 100% with about 12% overshoot
     ("back-out" easing). A ring ripples outward and the halo flares.
   - **1450 onwards, idle:** the logo breathes ±1.8% and a faint breeze keeps
     flowing in (streaks are recycled). The button fades in at 1650.
4. **Dismissal:** a click or tap anywhere, or **Enter / Space / Escape**,
   fades the overlay out over 0.4s and removes it. Focus moves to `<main>`.
   It can be dismissed at any point, even mid-wind.

**Theme:** follows the site's toggle (`localStorage.theme === "dark"`, the
same flag `scripts.js` uses for `body.dark`).
**Reduced motion:** with the OS "reduce motion" setting, there are no
particles or scaling. The logo and button fade in, then it waits for a click
as usual.
**Safety:** the CSS cover hides itself after 4s even if the JS fails. The
intro is skipped if the page takes more than 3.5s to load, and any error
removes the overlay. It doesn't touch `scripts.js`, the theme toggle or the
subscribe form.

## Testing

- `index.html?intro=1` forces it to play (ignores "seen this session").
- `index.html?intro=0` disables it.
- Or clear it in DevTools → Application → Session Storage → delete `ueIntroSeen`.

## Tweaking

**Timing** (`intro.js`, "Timeline"):
`T_WIND_END` (streaks all arrived), `T_POP` / `T_POP_END` (pop start/end),
`T_HINT` (when the button appears). The fade-out length is
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
| Background | `#EEF2F6` | `#111111` (site dark bg) |
| Logo | `#D8EBFC` (PNG as-is) + `#315372` outline/shadow | `#D8EBFC` (PNG as-is) + `#D8EBFC` glow |
| Streaks (main / alt) | `#90BADF` / `#669CCC` | `#D8EBFC` / `#90BADF` |
| Pop ring | `#669CCC` | `#D8EBFC` |
| Halo | `#315372` at 16% | `#D8EBFC` at 20% |
| Button text | `#437EB1` | `#D8EBFC` |

- Streak and ring colours: `PALETTE` at the top of `intro.js`.
- Background, halo, logo shadow, button: the CSS variables in `.ue-intro`
  (light) and `.ue-intro.is-dark` (dark) in `styles.css`. The pre-paint cover
  uses the same background (`html.ue-intro-pending::before`, `html.ue-intro-dark`).

**Show on every visit instead of once per session:** delete the
`store("get") === "1"` check near the top of `intro.js`.
