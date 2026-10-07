# BenefitFinder

BenefitFinder is a mobile-first, installable benefits navigator for Sunnyvale and Santa Clara County. Residents can describe their situation in plain language or use a guided form. AI converts free text into a constrained profile; a deterministic rules engine—not the model—ranks verified programs and exposes the rule trace behind every result.

## What works

- Responsive desktop and mobile UI with PWA installation and offline shell caching
- English, Spanish, and Vietnamese interface copy
- Voice input where the browser supports Web Speech
- Free-text OpenAI intake with strict JSON Schema output and a local heuristic fallback
- SSN, account number, phone, email, and street-address redaction before hosted AI calls
- Pure eligibility rules with `all`, `any`, and operators `eq`, `in`, `gte`, `lte`, `in_list`, and `between`
- Ten programs sourced from official city, county, state, or federal pages
- Match evidence, verification dates, official links, and auditable rules traces
- Device-session-only profile storage, shareable text summaries, and print/PDF output

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The guided flow and local extractor work without any API key. To enable hosted AI intake, set `OPENAI_API_KEY` in `.env.local`. The server reads that environment variable; it is never sent to the browser or committed. `OPENAI_MODEL` defaults to `gpt-6-luna`, selected for focused, high-volume structured extraction. Change it only after comparing the included rules/eval scenarios.

## Verification

```bash
npm test
npm run lint
```

## Trust boundary

1. The client redacts nothing because untrusted clients are not a security boundary.
2. The server redacts sensitive patterns before the provider call and does not log intake text.
3. OpenAI returns only a structured `UserProfile`; it never returns an eligibility decision.
4. The deterministic rules engine evaluates the curated program records.
5. The interface cites the exact official source snippet stored with each program.

The app provides estimates, not legal or financial advice. Each agency makes the final eligibility determination.
