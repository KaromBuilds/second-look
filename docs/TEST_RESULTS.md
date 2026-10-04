# Test Results — docs/PACKET.md §11

Run 2026-10-03 against a local production build (`npm run build && npm run
start`) of the exact code pushed as Deploy 2, before pushing. Per the
project's standing rule (set after burning Gemini's free-tier quota during
Feature 6 testing), **no test here makes a live call to Gemini**. Tests
that need a Gemini response use one of two approaches, noted per test:

- **Mocked response:** the real client code runs for real (real
  client-side redaction, a real request to `/api/check`, real React
  rendering) — only the network response itself is a fixture, substituted
  via the Chrome DevTools Protocol's `Fetch.fulfillRequest`, intercepted
  before it would otherwise reach the server.
- **Real fallback path:** the server was started with `GEMINI_API_KEY`
  deliberately unset (`GEMINI_MODEL` left set), which makes
  `lib/gemini.ts` fail instantly with zero network calls — this exercises
  the actual `buildFallbackVerdict` code for real, not a fixture standing
  in for it. Confirmed zero live calls by response time (33–131ms; a real
  Gemini round-trip takes much longer, as seen during Feature 6).

Test 4's Safe Browsing check ran live against the real Google API — that
quota isn't the one being protected, and this reuses the same live
integration already proven working in Feature 5.

| # | Test | Expected | Result | Notes |
|---|---|---|---|---|
| 1 | Paste a message containing a CURP, RFC, CLABE and card number | All four replaced with tags; on-screen note lists 4 hidden items | **PASS** | `[CURP HIDDEN]`, `[RFC HIDDEN]`, `[CLABE HIDDEN]`, `[CARD HIDDEN]` all present in the preview; note read "4 private details hidden before checking — nothing was sent." No raw PII anywhere in the DOM. |
| 2 | Inspect the network request in DevTools | Payload contains only the redacted text | **PASS** | Captured the real outgoing `/api/check` request body via CDP: `{"text":"Mi CURP es [CURP HIDDEN], mi RFC es [RFC HIDDEN], deposita a la CLABE [CLABE HIDDEN] o a la tarjeta [CARD HIDDEN]"}` — exactly the redacted text, nothing else. |
| 3 | "Supplier changed account" message | Verdict: likely scam; type: supplier account change; 3 steps | **PASS** (mocked Gemini response) | Rendered "Likely scam: Supplier bank account change" header, 3 numbered steps including the required "contact them through a number you already have" step. The pattern-matching and verdict-shape logic this depends on is covered live in `lib/patterns.test.ts` and was also verified against the real Gemini API during Feature 6 development (see `DECISIONS.md`). |
| 4 | Message with a known test-malicious URL (Google's test URLs) | Safe Browsing flags it; escalation card shown | **PASS** (live Safe Browsing, Gemini on real fallback path) | `http://malware.testing.google.test/testing/malware/` → `dangerous_link: true`, `flagged_domains: ["malware.testing.google.test"]` from the real API. UI showed the "Dangerous link found" warning and the full "Get human help" card. |
| 5 | A normal, harmless message ("Your order is ready, pick it up Friday") | Low-risk verdict, no escalation | **PASS** (mocked Gemini response) | Rendered "Looks OK: None" with a green header, no "Get human help" card, no escalation notice. |
| 6 | Empty input and a 5,000-character input | Clear error message; no API call | **PASS** | Empty: "Please paste a message first.", 0 requests fired. 5,000 chars: "That message is too long to check (max 2,000 characters). Please paste a shorter excerpt.", 0 requests fired. Both confirmed via CDP network interception — zero `/api/check` requests reached the network layer in either case. |
| 7 | Gemini unavailable (bad key in preview) | Friendly fallback using pattern library only, labeled | **PASS** (real fallback path, no live call) | Response came back in 33ms (`source: "basic"`), verdict built entirely from the pattern library, explanation read "Basic check (AI unavailable)." — visible on screen, not just in the API response. |
| 8 | Persona test (Don Ramiro) via screenshots | Log of confusions; worst one fixed and redeployed | **DONE** | See below. |

## Test 8 — Persona walkthrough (Don Ramiro)

*Don Ramiro, 56, runs a small family manufacturing workshop. Uses
WhatsApp daily but distrusts new apps. Reads slowly on his phone. If a
screen confuses him, he closes it without saying anything.*

Walked the full flow at 390px width (iPhone-sized) with a mocked
"likely scam" Gemini response, screenshotting each step: landing →
pasting a supplier-scam message → the redaction preview → the loading
state → the result card → the escalation card → the reset button and
footer.

**Confusions noted, in order of severity:**

1. **(Worst — fixed)** The confidence band showed a bare percentage
   ("Confidence 92%") with nothing to anchor it to. A raw percentage asks
   the reader to supply their own sense of what counts as high or low —
   not a safe assumption for a non-technical reader with no statistics
   background. **Fix:** added a plain-language qualifier next to the
   number (`confidenceLabel()` in `components/ResultCard.tsx`): "Very
   sure" (≥80%), "Fairly sure" (60–79%), "Not very sure" (<60%). Now
   reads "Confidence 92% — Very sure." Verified in the rebuilt app.
2. *(Minor, not fixed — low severity)* The hero section (title, tagline,
   explanatory paragraph, 3-step "how it works," privacy badge) is long
   enough on mobile that the textarea itself is only barely visible at
   the very bottom of the first screen, requiring a scroll before Don
   Ramiro would see anything to actually interact with. Judged lower
   priority than the confidence-percentage issue: the numbered "how it
   works" list he'd see first literally walks him through what to do
   next ("1. Paste the message you received"), and scrolling itself is
   completely ordinary mobile behavior — this isn't the kind of dead end
   that would make him close the page. Left as-is; worth another look in
   a future round if it keeps coming up.
3. *(Very minor, not fixed)* "0 private details hidden before checking"
   for a message with no detectable CURP/RFC/card/phone/email could
   theoretically read as "did it not check anything?" rather than "there
   was nothing to hide here." The reassurance phrasing ("nothing was
   sent") still holds regardless of the count, so this was judged
   negligible.

No other confusions found — the escalation card's plain-language
resource list (bank, CONDUSEF, Policía Cibernética with tappable phone
numbers), the "Check another message" reset, and the "About & privacy"
footer all read clearly at this viewport size.
