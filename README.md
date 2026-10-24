# BenefitBeacon

BenefitBeacon is a mobile-first, installable benefits guide for Sunnyvale residents. A resident starts a natural conversation, may answer or skip optional follow-up questions, and receives source-linked matches from 52 city, county, state, federal, utility, and program-administrator records serving Sunnyvale.

The main experience is centered on the BenefitBeacon guide: residents describe their situation in their own words, receive useful optional questions, and can continue asking questions about any result. Residents may also browse every Sunnyvale program without sharing personal details.

The normal result path does not depend on live search. Structured rules remove known contradictions, a precomputed 128-dimensional local embedding ranks semantic similarity, and OpenAI—when configured—reorders only the supplied records and explains why they may apply. If AI is unavailable, deterministic ranking keeps the demonstration working. Live web search is an explicit, optional fallback.

Results are grouped into:

1. **Best matches:** programs addressing the resident’s stated need.
2. **Did you know?:** up to three adjacent benefits supported by location or another supplied fact.

Every result retains its official source URL and `Last checked` date. Results are informational leads; the program administrator makes the final eligibility decision.

Every program also has an **Explore this** guide. It opens as an in-page drawer, preserves a separate conversation for each program, and searches current official sources for every answer about eligibility, documents, deadlines, costs, and application steps. When published rules show that a missing resident detail matters, the guide asks a focused optional follow-up before answering. It recommends a verified phone number or official website only when the searched sources do not publish the answer or the program administrator must resolve a case-specific issue. The indexed results remain usable if that live guide is unavailable.

See [Product Requirements](./requirements.md), [Architecture and Technical Design](./ARCHITECTURE_AND_TECHNICAL_DESIGN.md), and the [Technical Specification](./BENEFITBEACON_TECHNICAL_SPEC.md).

## What works

- Responsive web/mobile PWA with offline shell caching
- Senior-friendly typography, large touch targets, keyboard focus, high contrast, reduced motion, and extra-large text
- English, Spanish, and Vietnamese interface copy
- OpenAI structured intake with local extraction fallback
- Optional, skippable follow-up questions
- Sensitive-number and contact-detail redaction before hosted intake calls
- Local Cloudflare D1/SQLite index with 52 programs currently exposed for Sunnyvale
- Precomputed local embeddings; no hosted vector database
- Structured eligibility contradiction checks before similarity ranking
- Optional OpenAI ranking and explanation constrained to indexed record IDs
- Official source links and record-level freshness dates
- Per-program AI guide with forced web search, adaptive optional follow-ups, last-resort verified handoffs, clickable citations, and previous/next program navigation
- Chrome/Edge side-panel companion that carries a selected program onto its official application, explains visible fields, and offers resident-approved safe fills without reading entered values or submitting forms
- User-invoked live-search fallback that cannot break normal indexed results
- Device-session-only resident profile state, sharing, and print/PDF output

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

To continue onto an official application with the side-panel guide, load the `extension` folder as an unpacked Chrome/Edge extension. See [extension setup and safety boundaries](./extension/README.md).

`npm run db:seed` validates `data/programs.seed.json`, precomputes embeddings, generates SQL, applies the schema, and loads Wrangler’s local D1 database. Local database files live under the ignored `.wrangler/` directory.

`OPENAI_API_KEY` is optional. With it, `OPENAI_MODEL` (default `gpt-6-luna`) handles intake extraction and indexed-record ranking/explanation. `OPENAI_DISCOVERY_MODEL` may independently select the model used only by the optional live fallback, and `OPENAI_PROGRAM_CHAT_MODEL` may select the per-program guide model. Without a key—or during an API timeout—the local extractor and deterministic ranking continue to work; source and application links remain available even when program chat cannot search.

## AI call boundaries

| Call | When | Purpose | May change program facts? |
|---|---|---|---|
| Intake extraction | After initial story | Extract explicit profile facts and propose optional follow-ups | No |
| Indexed ranking | After local retrieval | Reorder supplied record IDs and write relevance explanations | No |
| Live fallback research + curation | Only after the resident clicks **Check live sources** | Search allowed domains and structure validated candidates | Cannot overwrite the local index |
| Per-program guide | After **Explore this**, for each question or follow-up reply | Retrieve the selected record server-side, force current web search, ask for any necessary non-sensitive facts, then answer with clickable sources; contact handoff is used only when official information is unavailable | No; answers distinguish published rules from unknown resident facts |

The normal path never sends the original story to discovery. It sends only a constrained profile and derived geography.

## Refresh the program snapshot

1. Re-check each official source and update `data/programs.seed.json`, including `lastChecked`.
2. Run `npm run db:seed`.
3. Run `npm run lint && npm test`.

## Verification

```bash
npm run lint
npm test
```

BenefitBeacon provides informational estimates, not legal or financial advice.
