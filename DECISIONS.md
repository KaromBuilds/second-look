# Decisions

## 2026-10-03 — Feature 1: Scaffold and static UI

- Bootstrapped with `create-next-app` (TypeScript, Tailwind v4, App Router,
  ESLint), without a `src/` directory so `docs/` and `app/` sit side by side
  at the repo root.
- Used `--disable-git` on `create-next-app` and ran `git init` separately
  after all of Feature 1's files were in place, so the repo's first commit
  is the one specified in the implementation prompt rather than the
  scaffolder's own auto-commit.
- The system npm cache (`~/.npm`) has some root-owned entries, left over from
  an earlier `sudo npm install` elsewhere on this machine, and rejected
  writes. Worked around it for this install by pointing `npm_config_cache`
  at a scratch directory rather than touching `~/.npm`'s permissions. Not
  fixed system-wide — flagging in case a future `npm install` in this repo
  hits the same error.
- Renamed `docs/W8_PACKET.md` to `docs/PACKET.md` per the course's required
  naming. `docs/W8_mockup.png` keeps its filename — the image link inside
  the packet is relative and still resolves.
- Colors: deep green `#3E7C70` (brand/primary, `--color-brand` in
  `app/globals.css`) and warm amber `#C08A2E` (`--color-warning`) for
  warnings, matching `docs/W8_mockup.png`. Dropped the default
  `prefers-color-scheme: dark` block that `create-next-app` generates — the
  product brief calls for a calm, predictable white background for a
  non-technical user (Don Ramiro) who closes confusing screens without
  saying anything, so the page does not reflow for system dark mode.
- Base font size set to 17px via `html { font-size: 106.25% }` in
  `globals.css`, so Tailwind's rem-based text and spacing utilities scale up
  together and stay consistent, per the packet's "large readable fonts (min
  17px body)" requirement.
- The result area (`<div id="result">`) is an empty, inert container for
  now; Feature 3 onward will populate it. The "Take a second look" button
  has no `onClick` yet — it's wired up once `/api/check` exists.
- `.gitignore`: added `!.env.example` so the example env file (empty values
  only) is tracked despite the blanket `.env*` ignore rule.
- Removed the default `create-next-app` placeholder assets
  (`public/next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`)
  and the template landing-page markup in `app/page.tsx`, since none of it
  is used by the real UI.

## 2026-10-03 — Feature 1 fix: bigger type, taller button

- Bumped sizes for Don Ramiro (56, reads slowly on his phone): title
  `text-3xl` → `text-4xl` (38px rendered), tagline `text-lg` → `text-xl`
  (21px), label `text-base` → `text-lg` (19px), textarea copy `text-base` →
  `text-lg` (19px), button `text-lg` → `text-xl` with `py-4` → `py-5`
  (button is now 72px tall). Verified rendered font sizes with Chrome
  DevTools Protocol (`getComputedStyle`), not just the Tailwind class names,
  since the 17px floor comes from the `html { font-size: 106.25% }` rem
  scaling set in Feature 1 — every size above is comfortably past the
  packet's 17px minimum.
- Diagnosed a false "text overflows the viewport / placeholder wraps early"
  reading: headless Chrome's `--screenshot --window-size=390,844` flag does
  **not** reliably set the actual rendering viewport (it rendered at
  ~500px and scaled the PNG down to the requested dimensions, which looked
  like a right-side overflow). Confirmed with `Emulation.setDeviceMetricsOverride`
  over the DevTools Protocol that the real layout has no overflow at 390px
  or at desktop widths (1440px) — `main` is correctly capped at `max-w-lg`
  (544px at the 17px root) and centered with `mx-auto`. Simplified the page
  wrapper from a `flex justify-center` row to a plain block + `mx-auto` on
  `<main>` while investigating; kept the simplification since it's easier to
  reason about, even though it wasn't the actual cause.
- For any future visual check in this project: use the Chrome DevTools
  Protocol (`--remote-debugging-port`, `Emulation.setDeviceMetricsOverride`,
  `Page.captureScreenshot`) instead of the plain `--screenshot
  --window-size=WxH` CLI flags, which don't reliably control the viewport
  in this Chrome version.

**Tomorrow's first move:** build `lib/redact.ts` (Feature 2 — client-side
zero-data redaction) with its Vitest suite.
