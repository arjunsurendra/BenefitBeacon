# BenefitBeacon — Technical Specification

## Product thesis

BenefitBeacon converts a resident’s plain-language situation into a small, privacy-conscious profile, then matches that profile against a presentation-ready local index of authoritative programs. The system is designed so network or model failure cannot remove the core result path.

The current resident-facing scope is Sunnyvale. The snapshot exposes 52 active records serving Sunnyvale, checked on October 23, 2026. Every record stores its own official source URL and freshness date. The data model retains multi-city support for a later expansion, but the current API rejects locations outside Sunnyvale.

## Runtime request flow

```text
Situation text
    -> validation and sensitive-pattern redaction
    -> OpenAI structured intake OR local extractor
    -> optional, skippable follow-ups
    -> city/ZIP/address resolution
    -> SQLite city-scope query
    -> hard contradiction filters
    -> local vector similarity + structured boosts
    -> candidate pool
    -> OpenAI rank/explain OR deterministic rank
    -> up to 5 direct + 3 related source-linked results
```

Live search is not part of this critical path. The resident can invoke it separately after indexed results appear.

## Local program data

The source of truth is `data/programs.seed.json`. The build script validates record IDs and HTTPS URLs, creates a deterministic 128-dimensional embedding, and generates `data/programs.seed.sql`. Wrangler stores the seeded D1 database as local SQLite files under `.wrangler/`.

Each record includes:

- identity, level, jurisdiction, city scope, and category;
- summary, benefit, published eligibility text, and application URL;
- official source URL, source label, source excerpt, and `lastChecked` date;
- interest and audience tags;
- structured constraints for housing, age, income targeting, children, disability, veteran, and caregiver status;
- precomputed embedding and active status.

## Retrieval and ranking

1. Query active records whose `city_scope` includes the resolved city.
2. Remove only records contradicted by an explicit resident fact. Missing facts remain unknown.
3. Embed the constrained profile locally using the same signed feature-hash algorithm used at seed time.
4. Score cosine similarity plus need, audience, jurisdiction, and income-targeted boosts.
5. Build a bounded pool of up to ten direct and six related candidates.
6. If OpenAI is configured, allow it to return only candidate IDs, `matchType`, score, and explanation.
7. Reject unknown IDs and cap output at five direct and three related records.

The embedding implementation uses 128 normalized dimensions with token synonym expansion and bigrams. A hosted vector database is intentionally unnecessary for a 62-row corpus; an in-process scan is faster to operate and easier to demonstrate.

`relevanceScore` is an ordering signal, not an eligibility probability.

## AI calls

### Intake extraction

- Model: `OPENAI_MODEL`, default `gpt-6-luna`
- Input: server-redacted story text
- Output: strict `UserProfile`, extraction confidence, and optional follow-up questions
- Fallback: deterministic local extractor

### Indexed ranking and explanation

- Model: `OPENAI_MODEL`, default `gpt-6-luna`
- Input: derived geography, constrained profile, and a bounded set of complete indexed records
- Output: record ID, direct/related classification, score, and resident-specific relevance reason
- Guardrail: the model cannot add a program, URL, amount, eligibility condition, or other program fact
- Fallback: deterministic local ordering and templated reasons

### Optional live fallback

- Trigger: only when the resident clicks **Check live sources**
- Model: `OPENAI_DISCOVERY_MODEL`, then `OPENAI_MODEL`, then `gpt-6-luna`
- Tool: Responses API `web_search`, constrained to allowed government, utility, and program domains
- Process: one research call and one strict-schema curation call
- Validation: HTTPS, allowed host, consulted-source support, duplicate removal, and group caps
- Failure: indexed results remain on screen

### Per-program source-grounded guide

- Trigger: the resident opens **Explore this** and submits a question about one result
- Model: `OPENAI_PROGRAM_CHAT_MODEL`, then `OPENAI_DISCOVERY_MODEL`, then `OPENAI_MODEL`, then `gpt-6-luna`
- Tool: Responses API `web_search` with `tool_choice: required`, current external access, and domains limited to the selected source plus approved government, utility, and program administrators
- Input: server-retrieved indexed record, allowlisted coarse profile fields, up to eight recent messages for that program, and the current question
- Output: plain-language guidance or an explicit `FOLLOW_UP_REQUIRED` protocol response, URL-citation annotations, and the consulted-source list; the protocol marker is removed server-side before display
- Follow-up policy: after searching published rules, ask one focused question containing only the missing non-sensitive fact or closely related facts required to continue; do not repeat answered questions, and provide general guidance when the resident skips
- Handoff policy: suggest a verified official phone number or website only when the searched pages do not publish the answer, the issue is application/account-specific, or administrator discretion is required
- Guardrails: no definitive eligibility decision, clear separation of published requirements from unknown user facts, no sensitive identifiers, server-side record lookup, HTTPS/host filtering, per-client rate limiting, and no response storage
- Client behavior: accessible same-page drawer, separate in-memory conversation per program, distinct follow-up cards, a **Skip this detail** action, adaptive composer guidance, clickable evidence, suggested questions, mobile layout, and previous/next program navigation
- Failure: the indexed summary, official source, and application link remain available

### Browser application guide

- Runtime: Chrome/Edge Manifest V3 side panel; no API key or model call runs inside the extension
- Handoff: the web app sends the selected canonical program, safe structured profile, and bounded per-program conversation through a same-page extension bridge into `chrome.storage.local`
- Permissions: permanent host access only for BenefitBeacon development/hosted origins; each external HTTPS origin is optional and requested only after the resident chooses **Connect to this page**
- Inspection: visible field label, type, allowed select options, required state, and empty/non-empty completion state; entered values are never returned to the side panel or API
- Assistance: highlight a field, ask a source-grounded question through the existing server API, or approve a deterministic profile suggestion one field at a time
- Blocked fields: passwords, uploads, SSN/tax identifiers, bank or account details, PIN/passcodes, signatures, identity-document numbers, full birth dates, and similar sensitive labels
- Prohibited automation: submit, sign, accept terms, upload, bypass verification, click through the workflow, or make a final eligibility assertion
- Storage: local browser-profile session, settings, and at most 20 recent messages per program; no server-side form or application state
- Failure: protected cross-origin frames may not expose their labels; chat and the official application link continue to work

## Result grouping

- **Direct:** addresses an explicitly stated need. If no need is stated, an explicit profile fact may support a direct match.
- **Related:** an adjacent high-value benefit supported by location or another supplied fact.
- Generic availability alone is not enough for a related result.

## Geography

Sunnyvale ZIP codes `94085`, `94086`, `94087`, and `94089` map directly to the supported city. City names are resolved locally, and other cities are rejected by the resident-facing discovery endpoint. A street address is sent only to the U.S. Census geocoder, then discarded; it is never stored or sent to OpenAI.

## Privacy and storage

- No resident account or server-side resident-profile database
- Browser profile state limited to `sessionStorage`
- Common identifiers, emails, phone numbers, and street-address patterns redacted before hosted intake
- Discovery receives broad structured fields, not the original story
- API keys remain server-side
- Local SQLite contains public program records only
- Optional live-research cache keys use normalized geography and coarse profile signals

## Failure behavior

| Failure | Behavior |
|---|---|
| Hosted intake unavailable | Continue with local extraction and optional questions |
| Indexed ranking call unavailable | Continue with deterministic local ranking |
| Live fallback unavailable | Preserve indexed results and show a non-destructive error |
| Address geocoder unavailable | Ask for city/state or ZIP |
| Local database missing | Instruct operator to run `npm run db:seed` |
| Candidate contradicts an explicit fact | Exclude it before AI ranking |

## Quality gates

Automated checks cover dataset size and uniqueness, supported-city coverage, HTTPS sources, embedding determinism and relevance, geography normalization, source validation, rendered accessibility/PWA metadata, and production compilation. Before the presentation, re-open high-priority source pages, update each changed record and its `lastChecked` date, reseed, and rerun the suite.
