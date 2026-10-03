# Week 8 · Implementation Prompt — Second Look

Paste everything below into Claude Code, opened in an empty folder named `second-look`.

---

You are building **Second Look**, a one-page web app for Mexican small-business owners. The owner pastes a suspicious message (WhatsApp, SMS or email), and the app tells him whether it looks like a scam, what kind, and three safe steps, **without any private data ever leaving his browser**. Read `docs/PACKET.md` first; it is the source of truth. Build in small, testable features, in the order below. After each feature: run it, check the acceptance criteria, commit with the message given, and stop to show me the result before continuing.

## Ground rules

- **Stack:** Next.js (App Router, TypeScript) + Tailwind. Deploy on Vercel. **No database, no auth, no analytics, no logging of message text** (zero-data rule).
- **UI language:** English. The messages users paste will be in Spanish; everything must handle accents and ñ.
- **Secrets:** `GEMINI_API_KEY`, `GEMINI_MODEL` and `SAFE_BROWSING_API_KEY` live only in `.env.local` (gitignored) and Vercel env vars. Never hardcode them, never send them to the client. Add `.env.example` with empty values.
- **Design:** calm, not alarming. White background, deep green accent (#3E7C70), amber for warnings, large readable fonts (min 17px body), big tap targets, mobile-first. Match `docs/W8_mockup.png`.
- **Simulated data must be labeled on screen** wherever it is used.
- Keep a `DECISIONS.md` at the root. **At the end of every session:** add the decisions made, write "Tomorrow's first move: …", commit and push.

## Feature 1 — Scaffold and static UI
Create the Next.js app, Tailwind, `README.md`, `DECISIONS.md`, `.env.example`, and copy `docs/` in. **Rename `docs/W8_PACKET.md` to `docs/PACKET.md`** (the course requires that exact name; the image link inside it stays valid). Build the static page: title "Second Look" with tagline "Before you pay, take a second look.", a large textarea ("Paste the message you received"), a "Take a second look" button, and an empty result area.
**Accept when:** `npm run dev` shows the page matching the mockup layout on a 390px-wide screen.
**Commit:** `feat: scaffold Next.js app and static UI`

## Feature 2 — Zero-data redaction (client-side)
Create `lib/redact.ts`, a pure function `redact(text) → { clean, found: Array<{type, count}> }` that replaces, **in the browser only**:
- CURP (18 chars, standard pattern) → `[CURP HIDDEN]`
- RFC (12–13 chars, persona física/moral) → `[RFC HIDDEN]`
- Card numbers (13–19 digits, spaces or dashes allowed, **Luhn-valid only**) → `[CARD HIDDEN]`
- CLABE (exactly 18 digits) → `[CLABE HIDDEN]`
- Mexican phone numbers (10 digits, optional +52) → `[PHONE HIDDEN]`
- Emails → `[EMAIL HIDDEN]`
- The value after keywords `contraseña`, `password`, `NIP`, `PIN`, `código`, `codigo`, `token`, `clave` → `[SECRET HIDDEN]`

Keep URLs intact (they are needed for the link check). Show a live preview of the redacted text with grey pill tags, and a green note: "N private details hidden before checking — nothing was sent." The number must equal the number of tags shown.
Write unit tests (`vitest`) with at least 12 cases, including false-positive checks (an order number like "Pedido 4521" must NOT be hidden; a non-Luhn 16-digit number must not be tagged as a card).
**Accept when:** all tests pass and the preview updates as you type.
**Commit:** `feat: client-side zero-data redaction with tests`

## Feature 3 — API route with validation
Create `POST /api/check` that receives **only** `{ text: string }` (already redacted). Validate: string, 10–2,000 characters, max 5 URLs; otherwise return 400 with a friendly message. Extract URLs. Return a placeholder JSON for now. Do not log the body anywhere.
Wire the button to call it; show a loading state and errors in plain language.
**Accept when:** in DevTools → Network, the request payload contains only redacted text; an empty or 5,000-character input shows a clear error and makes no call.
**Commit:** `feat: validated /api/check route wired to UI`

## Feature 4 — Simulated scam pattern library
Create `data/patterns.json` with 8 Mexican scam scripts, each with `id`, `name`, `keywords` (Spanish), `red_flags`, `safe_steps` (3), and `"simulated": true`:
1. Supplier changed bank account
2. Fake SAT fine / SAT mailbox notice
3. Fake federal plate (placas) fine
4. Package with wrong address / delivery fee
5. Bank "suspicious activity, confirm your code"
6. Family emergency / "I changed my number"
7. Fake job or prize requiring a deposit
8. Fake invoice or CFDI to download

Create `lib/patterns.ts` that scores the text against the library and returns the top match and score. Show on the result card: "Pattern library: simulated data".
**Accept when:** a "supplier changed account" message returns pattern 1 as the top match.
**Commit:** `feat: simulated Mexican scam pattern library`

## Feature 5 — Security API: Google Safe Browsing
In the API route, check extracted URLs with the Safe Browsing Lookup API v4 (`threatMatches:find`, threat types MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE, POTENTIALLY_HARMFUL_APPLICATION). On any match, mark `dangerous_link: true` and show which link (domain only). If the API fails, continue and say "Link check unavailable right now".
**Accept when:** one of Google's test URLs (`http://testsafebrowsing.appspot.com/s/phishing.html` or `http://malware.testing.google.test/testing/malware/`) is flagged, and a normal URL is not.
**Commit:** `feat: Google Safe Browsing link check`

## Feature 6 — Gemini analysis with structured output
Call Gemini (model from `GEMINI_MODEL`; first list available models with the API and pick a current Flash model; never hardcode a deprecated one) with the redacted text, the top pattern match, and the Safe Browsing result. Request **JSON only**:
`{ verdict: "likely_scam" | "suspicious" | "looks_ok", scam_type, confidence (0–100), red_flags: string[], steps: [3 strings], escalate: boolean, explanation (max 2 sentences) }`
System prompt rules: answer in **simple English a non-technical owner understands**; never ask the user for personal data; never tell them to click links in the message; always include "contact them through a number you already have" when someone claims to be a known contact; validate the JSON and retry once if malformed.
**Escalate = true** if confidence < 60, a dangerous link was found, or the text says money was already sent.
**Fallback:** if Gemini fails, build the result from the pattern library only and label it "Basic check (AI unavailable)".
**Accept when:** the supplier message returns `likely_scam`, a type, 3 steps; a harmless message ("Su pedido está listo, pase el viernes") returns `looks_ok` with no escalation.
**Commit:** `feat: Gemini analysis with structured JSON and fallback`

## Feature 7 — Result card and escalation
Build the result card like the mockup: colored header by verdict (amber likely scam, yellow suspicious, green looks ok), confidence bar, numbered steps, red flags in a collapsible "Why?" section. If `escalate`, add a "Get human help" card with: "Call your bank using the number on the back of your card", CONDUSEF (link to condusef.gob.mx), Policía Cibernética (SSC CDMX, 55 5242 5100 ext. 5086, or 088), and Buró de Crédito Bloqueo (if personal data may have been stolen). Add a "Check another message" button that clears everything from memory.
**Accept when:** all three verdicts render correctly on a phone-sized screen; the reset leaves no text on the page.
**Commit:** `feat: result card and human escalation`

## Feature 8 — Deploy 1
Push to GitHub (`KaromBuilds/second-look`), import into Vercel, set the three env vars, deploy.
**Accept when:** the full flow works at the live URL.
**Commit:** `chore: first production deploy`

## Feature 9 — Security floor check + Deploy 2
Verify: no secrets in the repo (search git history), `.env*` gitignored, input limits enforced server-side, no personal data stored anywhere, demo messages invented. Add an "About & privacy" footer: "Second Look stores nothing. Private details are hidden on your device before checking. Pattern library is simulated." Fix any bug found in the test plan (`docs/PACKET.md` §11), redeploy.
**Accept when:** every test plan row passes on the live URL; record results in `docs/TEST_RESULTS.md`.
**Commit:** `fix: security floor checks and test-plan fixes` → redeploy

## Done means
Live URL works end to end · ≥ 5 commits and 2 deploys · `DECISIONS.md` and `docs/TEST_RESULTS.md` filled · nothing personal ever leaves the browser.
