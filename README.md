# Second Look

> Before you pay, take a second look.

Second Look is a one-page web app that helps small Mexican business owners
check a suspicious WhatsApp, SMS or email message in under 30 seconds — a
plain-language verdict, the scam type, and three safe steps, **without any
private data ever leaving the browser**.

See [`docs/PACKET.md`](docs/PACKET.md) for the full product spec and
[`docs/W8_IMPLEMENTATION_PROMPT.md`](docs/W8_IMPLEMENTATION_PROMPT.md) for the
feature-by-feature build plan.

## Zero-data rule

CURP, RFC, card numbers, CLABE, phone numbers, emails, and anything after
words like "contraseña" or "código" are redacted in the browser before
anything is sent to the server. No database, no auth, no logging of message
text.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in GEMINI_API_KEY, GEMINI_MODEL, SAFE_BROWSING_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js (App Router, TypeScript) + Tailwind CSS. Deployed on Vercel. No
database, no analytics.

## Status

See [`DECISIONS.md`](DECISIONS.md) for the build log and the next move.
