# BenefitBeacon

BenefitBeacon is a mobile-first, installable benefits navigator for Sunnyvale and Santa Clara County. Residents describe their situation once, can answer or skip dynamically selected follow-up questions, and receive one final list combining reviewed matches with relevant live findings. AI converts free text into a constrained profile; a deterministic rules engine—not the model—ranks verified programs and exposes the rule trace behind every result.

See [Architecture and Technical Design](./ARCHITECTURE_AND_TECHNICAL_DESIGN.md) for system diagrams, component responsibilities, request flows, API contracts, trust boundaries, deployment, failure behavior, and production recommendations.

## What works

- Responsive desktop and mobile UI with PWA installation and offline shell caching
- English, Spanish, and Vietnamese interface copy
- Free-text OpenAI intake with strict JSON Schema output and a local heuristic fallback
- Optional follow-up questions for every missing factor that can materially improve matching
- SSN, account number, phone, email, and street-address redaction before hosted AI calls
- Pure eligibility rules with `all`, `any`, and operators `eq`, `in`, `gte`, `lte`, `in_list`, and `between`
- Ten programs sourced from official city, county, state, or federal pages
- Match evidence, verification dates, official links, and auditable rules traces
- Device-session-only profile storage, shareable text summaries, and print/PDF output
- Automatic live discovery after intake when a city or ZIP is available
- Census address-to-geography resolution, official-domain web search, citation validation, deduplication, and 24-hour geography caching

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The local extractor and reviewed rules work without any API key. To enable hosted AI intake and live program discovery, set `OPENAI_API_KEY` in `.env.local`. The server reads that environment variable; it is never sent to the browser or committed. `OPENAI_MODEL` defaults to `gpt-6-luna`, selected for focused, high-volume structured extraction. `OPENAI_DISCOVERY_MODEL` can override the discovery model independently.

Live discovery runs after the resident submits or skips the optional follow-up step. An uncached geography makes two Responses API calls: the first uses the `web_search` tool with an official-domain allowlist, and the second ranks cited findings against the broad structured profile. Cached geography research needs only the ranking call. The model produces a relevance explanation, never an eligibility probability. Newly discovered programs are clearly separated from reviewed matches and never receive an eligibility status.

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
6. Live discoveries must pass HTTPS host allowlisting and citation checks before display.

The app provides estimates, not legal or financial advice. Each agency makes the final eligibility determination.
