# Decisions

## Known issues — pending, final polish pass only

Confirmed by the user in real Safari on 2026-10-03, after the layout
redesign. Explicitly deferred — do not fix until the final polish pass
(packet §9/§11 territory), not during feature work:

- Placeholder text still wraps early in real Safari ("Hi, this is your /
  supplier, we...") even though `cols={1}` was set specifically to make
  CSS width the only sizing signal and this was verified fixed in
  Playwright's WebKit build. Real Safari.app evidently still doesn't
  agree — needs a fresh look (possibly a different mechanism than the
  `cols`/wrap-measure one already fixed, since that one measurably works
  in WebKit 26.6).
- The form card (right column on desktop, the bordered box with the
  textarea and button) is too narrow. Current width is a fixed
  `lg:grid-cols-[1fr_440px]` — needs a wider or more flexible value.
- Long URLs overflow the "What we'll check" preview box to the right
  instead of wrapping. Confirmed by the user in real Safari on 2026-10-03,
  after the Safe Browsing feature (where the dangerous-link warning itself
  was confirmed working correctly). Needs a `break-all`/`overflow-wrap`
  rule on the preview box or on the URL segment specifically, since a URL
  is one long unbreakable token with no natural wrap points.

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

## 2026-10-03 — Feature 2: Zero-data redaction (client-side)

- `lib/redact.ts` runs CURP → RFC → CLABE → card (Luhn-checked) → phone →
  email → secret-keyword-value as ordered regex passes, each converting its
  matches into a `[TYPE HIDDEN]` tag before the next pass runs. The order
  matters: once a span is replaced with a tag it's just letters in brackets,
  so a later, looser pass (e.g. the bare-digit phone check) can't re-match
  digits that already belong to an earlier, more specific tag. Email and the
  secret-keyword pass run first since URLs are protected before any of this
  (see below) and emails/keywords are the most self-contained shapes.
- URLs are swapped out for a private-use-Unicode-wrapped index
  (`<n>`) before any redaction pass runs, then swapped back in
  at the end — not a plain word like `"URL"`, which a real message could
  contain verbatim and which would then collide with the restore step.
- Card vs. CLABE: CLABE requires exactly 18 *contiguous* digits (no spaces
  or dashes allowed by the packet's definition); the card pass only
  considers 13-19 digit runs that are Luhn-valid. An 18-digit run typed with
  no separators is reported as CLABE, not card — the packet doesn't ask for
  that ambiguity to be resolved any other way.
- Picked vitest 3.2.7 over the latest 5.x line: vitest 5 requires
  `@types/node` ^22 or >=24, but `create-next-app`'s template pins `^20`,
  and bumping that major for one test runner felt like more risk than it
  was worth. vitest 3 declares `@types/node` `^18 || ^20 || >=22`, so it
  installs clean against what's already there.
- 19 unit tests in `lib/redact.test.ts` (packet asked for 12+), including
  the two required false-positive cases (an order number like "Pedido 4521"
  stays untouched; a non-Luhn 16-digit number is not tagged as a card), a
  Luhn-valid 19-digit card that must not be mistaken for an 18-digit CLABE,
  a URL whose digits must survive untouched, and an invariant test that the
  number of `[... HIDDEN]` tags in the output always equals the sum of
  `found[].count`.
- The live preview (`app/page.tsx`) keeps the real `<textarea>` showing
  exactly what the owner typed, and adds a separate "What we'll check" box
  below it rendering the redacted text with the `[TYPE HIDDEN]` tags as grey
  pills, plus the green "N private details hidden" note — rather than
  swapping the textarea's own content, so the owner can always see both
  what they wrote and what will actually be sent.
- Verified the live-typing behavior with a real headless Chrome tab driven
  over the DevTools Protocol (`Input.insertText` into the focused textarea,
  then read `textarea.value` and the rendered pill count back out) rather
  than just trusting the unit tests — confirmed the pill count and the
  green note's number match exactly, and that nothing overflows at 390px
  while typing a long message.

## 2026-10-03 — Feature 2 fix: English-only UI + real-Safari wrap bug

- The textarea placeholder was still in Spanish
  ("Hola, soy tu proveedor..."); every other visible string was already
  English. Fixed to "Hi, this is your supplier, we changed bank
  accounts...". Every user-facing string in the app must be English per the
  packet's "UI language: English" rule — the message the owner *pastes* is
  expected to be Spanish or English, but the app's own copy, and later
  Gemini's verdict/steps and the pattern library's `name`/`red_flags`/
  `safe_steps` (Features 4 and 6), are not.
- Because messages may arrive in either language, `lib/redact.ts`'s
  secret-keyword list needed an English counterpart for every Spanish-only
  entry: added `code` alongside `código`/`codigo` (`password`, `NIP`, `PIN`,
  `token` already read identically in both languages). CURP/RFC/CLABE/
  card/phone/email detection were already language-independent (they match
  on shape, not words), so those needed no change; added a test confirming
  CURP + phone redaction inside an English sentence.
- The reported "placeholder wraps into 3 short lines in real Safari even
  though the box is wide" was real — the Chrome DevTools Protocol check in
  the prior entry wasn't enough, because the bug is WebKit-specific. Could
  not reproduce it with a screenshot tool here: `screencapture` and
  Safari's own `do JavaScript` AppleEvent both require macOS permissions
  (Screen Recording; "Allow JavaScript from Apple Events", which itself
  needs writing a sandboxed `com.apple.Safari` preference) not available to
  this process. Installed `playwright` + its real WebKit 26.6 browser
  instead (no OS permissions needed, since it talks to its own browser
  process directly) — confirmed the fix, then removed `playwright` again
  since it isn't part of the project's stack, it was only a one-off
  diagnostic tool.
- Root cause: `<textarea>` has an implicit `cols="20"` even when the
  attribute is never written in JSX, and some WebKit versions use that
  20-character estimate for *where the placeholder wraps*, independently of
  the element's actual CSS width — the box itself was already correctly
  100% width (confirmed by `getBoundingClientRect`), only the wrap measure
  was wrong. The old Spanish placeholder's wraps ("Hola, soy tu prove" /
  "edor, cambiamos de" / "cuenta bancaria...") are each ~19 characters,
  matching `cols=20` almost exactly. Fixed by explicitly setting
  `cols={1}` on the textarea so the CSS width is the only sizing signal
  browsers have, for both the box and the wrap measure, in every engine —
  not just a Chrome-only fix.
- Lesson for next time: a Chrome-only (or Chrome-DevTools-Protocol-only)
  check is not sufficient to close out a cross-browser layout complaint,
  even when it looks conclusive. Don't dismiss a user's real-browser bug
  report on the strength of one engine's rendering.

## 2026-10-03 — Feature 3: API route with validation

- `app/api/check/route.ts` validates `{ text: string }`: non-empty string,
  10-2,000 characters, max 5 URLs — in that order, each with its own
  friendly error message and a 400 status. Returns a placeholder JSON body
  for now (`{ placeholder: true, textLength, urls }`, URLs reduced to
  hostnames) — Features 4-6 replace this with the real pattern-library
  match, Safe Browsing result, and Gemini verdict.
- Pulled URL extraction out of `lib/redact.ts` into `lib/urls.ts`
  (`extractUrls`), and the length/URL-count rules into
  `lib/checkLimits.ts` (`friendlyCheckError`), so the client and the route
  both import the exact same validation logic and error copy instead of
  two hand-written copies that could silently drift apart.
- The route never logs `request` or the extracted `text` — a comment at the
  top of the file calls this out explicitly so a future edit doesn't
  casually add a `console.log(text)` for debugging. The zero-data rule
  applies on the server, not just in the browser.
- `app/page.tsx`: the button now calls `handleCheck`, which re-runs the
  same `friendlyCheckError` check client-side first (so an empty or
  too-long message never reaches `fetch` at all), then POSTs
  `{ text: clean }` — the redacted text, never the raw textarea value —
  and renders a loading state (`disabled`, "Checking…"), a plain-language
  error, or a temporary success line in `#result`. Editing the textarea
  again resets all three (`status`/`errorMessage`/`result`) so a stale
  error or result can't linger next to new text.
- Verified over the Chrome DevTools Protocol, not just by reading the code:
  intercepted `Network.requestWillBeSent` while driving the real page —
  an empty textarea and a 5,000-character one both fire zero requests to
  `/api/check` (plain-language error shown instead), and a message
  containing a CLABE and a phone number fires exactly one request whose
  `postData` contains only `"[CLABE HIDDEN]"` / `"[PHONE HIDDEN]"`, never
  the raw digits — matching the packet's Feature 3 acceptance test
  (§11 test 2) directly rather than just trusting it by inspection.
- Also exercised the route directly with `curl` for every validation
  branch (empty, too short, too long, 5,000 chars, too many links, missing
  `text` field, malformed JSON body, and a valid request) to confirm the
  server-side validation independently of the UI.

## 2026-10-03 — Root cause: why CSS edits weren't showing in real Safari

- Confirmed, not assumed: `curl`'d the dev server's CSS `<link>` URL across
  this entire session. It was byte-identical —
  `/_next/static/chunks/[root-of-the-server]__0cbk-n2._.css` — from the very
  first check after Feature 1 through the end of Feature 3, despite four
  rounds of style edits in between. In Turbopack's **dev** mode, that
  filename is stable by design (not content-hashed); new CSS is meant to
  reach an already-open tab by a live WebSocket push (Fast Refresh/HMR), not
  by the browser fetching a new URL.
- This session restarted the dev server process itself many times (`pkill
  -f "next dev"` + relaunch, to get a clean process for each round of CDP
  verification). Each restart is a brand-new HMR session. A tab that was
  open against an earlier instance, or that loaded the page and got a
  cached response for that same stable CSS URL at any point, has no
  content-hash change to force a fresh fetch — unlike a production build,
  where every changed file gets a new filename and any cache is
  automatically bypassed.
- This is also *why my own checks never caught it*: `curl` never caches
  anything, and both the Chrome DevTools Protocol session and the
  Playwright WebKit session started from a brand-new, empty browser profile
  each time — neither one had a stale cache to hit in the first place. Only
  a real, continuously-used browser tab can exhibit this.
- Verified by diffing against a production build: ran `npm run build` then
  `npm run start` and confirmed the CSS filename becomes content-hashed
  (`_next/static/chunks/2vvuxdan9oafq.css`, different from the dev
  filename and from itself on the next content change) and the file
  contains every current rule, including the new `lg:text-[56px]` etc.
  classes from today's redesign.
- Fix going forward: stop restarting the dev server repeatedly for routine
  checks — let one instance run continuously so HMR can do its job. For
  this round, verified against `npm run build && npm run start` instead of
  `next dev`, both because it sidesteps the stable-URL problem entirely and
  because it's a closer match to what actually ships to Vercel. Left that
  production server running (rather than switching back to `next dev`) so
  what the user checks in their own Safari is exactly what was verified
  here, with zero cache ambiguity.

## 2026-10-03 — Redesign: full-width product layout

- Replaced the single ~512px-wide centered column with a real marketing
  layout: `lg:grid-cols-[1fr_440px]` inside a `max-w-7xl` container (active
  at the `lg` breakpoint, 1024px+, so 1440px gets the two-column hero and
  390px stays single-column via a plain `flex flex-col`). Left side: title,
  tagline, a new one-paragraph explanation, a numbered 3-step "how it
  works" list, and a "Nothing you paste is stored" badge — none of that
  copy existed before today. Right side: the existing form, now presented
  as a bordered, shadowed card (`rounded-3xl border shadow-md`) rather than
  being the whole page.
- The result area (`#result`) moved out of the form card to sit full-width
  below the two-column grid — right now it still only shows the Feature 3
  placeholder/error text, but Feature 7's actual result card needs the full
  page width, not the 440px form column.
- Used literal arbitrary-value classes (`text-[56px]`, `text-[24px]`,
  `text-[19px]`, `text-[20px]`, `h-[64px]`) for every size the user gave an
  exact number for, instead of Tailwind's rem-based scale steps — this
  repo's `html { font-size: 106.25% }` (set in Feature 1, to guarantee the
  packet's 17px body-text minimum) would have thrown off any rem-based
  class by that same 6.25%, e.g. `text-6xl` would render 63.75px rendered,
  not 60. Arbitrary `px` values sidestep that entirely and make the numbers
  exact and easy to verify.
- Measured every requested number directly with
  `getComputedStyle(...).fontSize` and `getBoundingClientRect().height`
  over the Chrome DevTools Protocol at both 1440×900 and 390×844, against
  the production build described above:
  - 1440px: h1 `56px`, tagline `24px`, textarea `19px`, button `20px`
    text / `64px` tall — all exact matches. `display: grid` confirmed
    active; no horizontal overflow (`document.body.scrollWidth === 1440`).
  - 390px: h1 `38.25px`, tagline `21.25px`, textarea `19.125px`, button
    `21.25px` text / `72.25px` tall (mobile sizes from the Feature 1 fix,
    unchanged) — layout confirmed single-column (`display: flex`), no
    horizontal overflow (`scrollWidth === 390`).

## 2026-10-03 — The actual root cause of the broken/unstyled page

The previous entry's root-cause write-up was wrong in one specific way: it
correctly identified that Turbopack dev-mode CSS isn't content-hashed, but
the page the user then saw wasn't a dev-mode staleness issue at all — it
was broken by a mistake in how I recovered from `rm -rf .next`:

- `next start` spawns a process whose OS-visible name is `next-server
  (v16.3.8)`, **not** a string containing "next start". Every
  `pkill -f "next start"` I ran was matching nothing and silently
  succeeding (zero processes killed, zero error). `ps aux` confirms this is
  the real process title.
- So when I did `rm -rf .next` while a `next start` was running, then
  rebuilt and ran `npm run start` again, that second attempt crashed
  immediately with `EADDRINUSE` (logged, but I only `curl`'d the root page
  and saw `200`, so I never noticed the crash) — because the *first*
  process was still alive and still holding port 3000.
- That survivor process had been running continuously since before the
  `rm -rf .next`. It kept answering requests from its in-memory route
  cache (hence the HTML still loaded), but its HTML referenced a CSS
  filename that physically no longer existed on disk — confirmed directly:
  `curl` on the linked `/_next/static/chunks/*.css` returned `HTTP 500`.
  Unstyled HTML plus the already-applied `cols="1"` fix explains exactly
  what the user saw: a 1-character-wide textarea (the raw, unstyled
  `cols="1"` HTML attribute with no CSS to override it) and giant shield
  icons (an unstyled `<svg>` with no explicit `width`/`height` falls back
  to the browser's native replaced-element default, ~300×150 CSS pixels).
- Fixed by killing *by port* instead of by process name —
  `lsof -ti:3000 | xargs kill -9` — which doesn't depend on guessing what
  string appears in `ps`. Confirmed zero listeners on port 3000, then did
  one clean `rm -rf .next && npm run build && npm run start`, watched the
  start log directly (not just a root-page `curl`) to confirm it actually
  bound the port instead of crashing, and explicitly `curl`'d the CSS
  `<link>` target and got `200` with a non-zero byte count before touching
  anything else.
- Added a second, independent layer of defense so this exact failure mode
  (CSS absent or failing to load) can never make an icon fill the screen
  again: `ShieldSearchIcon` now takes a `size` prop and sets explicit
  `width`/`height` attributes on the `<svg>` itself, not just a CSS class.
  HTML width/height are a floor the browser uses before any stylesheet is
  parsed; the Tailwind `h-*`/`w-*` classes in `className` still win once
  CSS loads. Confirmed both `<svg>` tags in the served HTML carry literal
  `width="40" height="40"` and `width="16" height="16"`.
- Polish pass on top of the already-verified redesign: the check card now
  has `transition-shadow duration-300 hover:shadow-lg` (static `shadow-md`
  at rest), the textarea has `transition-colors duration-150` on its
  focus-ring change, and the button has a real hover interaction —
  `hover:-translate-y-0.5 hover:shadow-lg hover:bg-brand-dark`, eased with
  `transition-all duration-200`, reverting on `active:`/`disabled:` so it
  doesn't stay "lifted" mid-click or while loading.
- Verified the hover state for real, not just by reading the class names:
  drove a synthetic `Input.dispatchMouseEvent` to the button's center over
  the DevTools Protocol and read back `getComputedStyle` afterward. First
  attempt looked broken (`transform: none`) — turned out to be my own
  check reading the wrong CSS property: Tailwind v4 compiles translate
  utilities to the standalone `translate` property, not `transform` (confirmed
  directly in the compiled CSS: `translate:var(--tw-translate-x)
  var(--tw-translate-y))`. Reading the right property showed
  `translate: 0px -2.125px` (exactly `-0.5 × 0.25rem × 17px` root), the
  background color changed to `#2F5F55`, and the box-shadow's last two
  layers matched `shadow-lg`'s values — all three hover effects
  genuinely firing, confirmed, not assumed.
- Re-ran the full clean-restart sequence (kill by port → `rm -rf .next` →
  build → start → confirm the start log → confirm the CSS link resolves)
  after this polish pass too, then took fresh screenshots at 1440×900 and
  390×1500 over CDP and looked at both before writing anything here: no
  unstyled elements, no oversized icons, no horizontal overflow, numbered
  steps/badge/card all rendering as designed at both widths.

**Tomorrow's first move:** hold for the user to confirm the page now
renders correctly in their own Safari, then Feature 4 — `data/patterns.json`
(8 simulated Mexican scam scripts) and `lib/patterns.ts` to score the
redacted text against them.

## 2026-10-03 — User confirmed layout works; two items deferred

User checked the redesign in real Safari: layout works. Two remaining
issues (placeholder still wraps early; form card too narrow) logged above
under "Known issues — pending, final polish pass only" at the user's
explicit request, not fixed now.

**Tomorrow's first move:** Feature 4 — `data/patterns.json` (8 simulated
Mexican scam scripts, each with `id`, `name`, `keywords`, `red_flags`,
`safe_steps`, `"simulated": true`) and `lib/patterns.ts` to score the
redacted text against them.

## 2026-10-03 — Feature 4: Simulated scam pattern library

- `data/patterns.json` has the 8 scripts the packet lists (supplier
  account change, fake SAT notice, fake plate fine, fake delivery fee,
  fake bank security alert, family-emergency/new-number scam, fake
  job-or-prize, fake invoice/CFDI), each with `id`, `name`, `keywords`,
  `red_flags`, 3 `safe_steps`, and `"simulated": true`.
- `name`/`red_flags`/`safe_steps` are English — these are the fields that
  can end up shown to the user directly (as `scam_type` and in the
  Feature 6 Gemini-unavailable fallback, which the packet says "build[s]
  the result from the pattern library only"), so they're in scope for the
  user's "everything in English" rule from earlier today. `keywords` is
  the one field that's genuinely about matching, not display, so each
  pattern lists both Spanish and English phrasings — directly carrying
  forward the user's instruction that "keyword redaction and pattern
  matching must work in both languages," applied here the same way it was
  already applied to `lib/redact.ts`'s secret-keyword list.
- `lib/patterns.ts`'s `matchPattern(text)` scores every pattern by how many
  of its keywords appear in the text (substring match, not exact-word) and
  returns the single highest-scoring one with its score and which keywords
  matched, or `null` if nothing matched at all — deliberately not forcing a
  match onto an unrelated message. Both the input text and every keyword
  are lowercased and run through `.normalize("NFD")` with a `\p{Mn}`
  (nonspacing mark) strip before comparing, so matching doesn't care
  whether the owner typed accents or not.
- Not wired into `/api/check` yet — the packet's own sequencing does that
  in Feature 6 ("the top pattern match, and the Safe Browsing result" are
  what get passed to Gemini), after Feature 5 adds the Safe Browsing call
  to the route. Feature 4's own acceptance criterion is about
  `matchPattern`'s behavior directly, not the route.
- 12 Vitest cases in `lib/patterns.test.ts`, including the packet's literal
  acceptance test (a "supplier changed account" message scores pattern 1
  as the top match) run in both Spanish and English, an accent-sensitivity
  pair (same message with and without accents, same result), a
  no-keywords-matched case returning `null`, and a structural check that
  all 8 patterns have unique ids and exactly 3 safe steps.
- `lib/patterns.ts` imports the JSON via a relative path
  (`../data/patterns.json`), not the `@/` alias used everywhere else in
  this repo — Vitest's resolver doesn't pick up the `@/*` mapping from
  `tsconfig.json` the way Next's own bundler does, and it's a one-line
  relative import versus a new `vitest.config.ts` just to wire up an
  alias for a single sibling-directory import.

**Tomorrow's first move:** Feature 5 — add the Google Safe Browsing link
check to `/api/check`.

## 2026-10-03 — Feature 5: Google Safe Browsing link check

- `lib/safeBrowsing.ts`'s `checkUrls(urls)` calls the Lookup API v4
  (`threatMatches:find`) with all four threat types the packet lists
  (MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE,
  POTENTIALLY_HARMFUL_APPLICATION). It never throws: a missing API key, a
  non-2xx response, or a network error all come back as
  `{ available: false, dangerousUrls: [] }` rather than an exception, so
  one third-party API hiccup can't take down `/api/check` — exactly the
  packet's "If the API fails, continue" rule, implemented as a type the
  caller can't accidentally treat as "nothing dangerous" (`available` and
  "no matches" are different states).
- Wired into `app/api/check/route.ts`: the response now carries
  `dangerous_link` (true only when the lookup actually ran and found a
  match), `flagged_domains` (hostnames only, via the same `toHostname`
  helper already used for the general `urls` list — a flagged link's full
  URL, which could carry tracking parameters or other incidental data,
  never reaches the client), and `link_check_unavailable` (true only when
  there were URLs to check and the lookup itself failed — not when there
  were simply no links in the message).
- Extended `lib/urls.ts` with `toHostname`, shared between the general URL
  list and the flagged-domains list rather than duplicating the
  try/catch-around-`new URL()` logic a second time.
- Surfaced this minimally in the current placeholder UI (an amber
  "Dangerous link found: …" box, or a neutral "Link check unavailable
  right now" box, above the existing green placeholder line) — the
  packet's Feature 5 text itself says to "show which link" and "say" the
  unavailable message, which reads as this feature's own job, not
  something to defer entirely to Feature 7's full result card.
- 8 Vitest cases in `lib/safeBrowsing.test.ts`, with `fetch` mocked via
  `vi.stubGlobal` — no real network calls in the automated suite. Covers:
  zero URLs skips the call entirely, a missing key is reported as
  unavailable (not silently "safe"), a match is correctly surfaced, no
  match is correctly reported as not-dangerous, duplicate matches for the
  same URL are deduped, a non-2xx response and a thrown network error both
  come back as unavailable without throwing, and — directly relevant given
  this feature touches a real secret — a test that the API key only ever
  appears in the request URL's query string, never serialized into the
  request body.
- Verified the packet's actual acceptance test against the **real** Google
  Safe Browsing API, using the real key from `.env.local`: both of
  Google's official test URLs
  (`http://malware.testing.google.test/testing/malware/` and
  `http://testsafebrowsing.appspot.com/s/phishing.html`) came back
  `dangerous_link: true`, and a normal URL
  (`http://example.com/order/12345`) came back `false` — via `curl`
  against the running server, and separately by driving the real page
  end-to-end over the Chrome DevTools Protocol (typed the message,
  clicked the button, read back the rendered warning text and a
  screenshot) to confirm the full flow, not just the API response. The
  API key itself was never printed in any command, log, or test output —
  checked explicitly before starting this feature (`${#value}` character
  counts only, never the values) and grepped the server log afterward to
  confirm.

**Tomorrow's first move:** Feature 6 — call Gemini with the redacted text,
top pattern match, and Safe Browsing result; assemble the real structured
verdict (replacing today's placeholder response) with a pattern-library
fallback if Gemini fails.
