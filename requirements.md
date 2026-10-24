# BenefitBeacon Requirements

## 1. Purpose

BenefitBeacon is a resident-facing benefits guide for Sunnyvale, California. It helps people discover public-benefit and assistance programs, understand published eligibility rules, ask questions about a selected program, and continue receiving guidance while completing an official application.

The core benefits-discovery experience must remain usable when AI services or live web search are unavailable.

## 2. Product goals

BenefitBeacon shall:

1. Give residents a simple way to discover relevant assistance without knowing program names.
2. Present authoritative, source-linked program information in clear language.
3. Ask only useful, optional questions and allow every question to be skipped.
4. Keep residents on the official program or application website for final decisions and submission.
5. Remain dependable during a demonstration through a local program index and deterministic fallbacks.
6. Be usable by older adults and residents using assistive technology or mobile devices.

## 3. Current scope

### 3.1 Included

- Sunnyvale residents and programs serving Sunnyvale.
- City, Santa Clara County or regional, California, federal, regulated-utility, and direct program-administrator programs.
- A curated resident-facing catalog of 52 active Sunnyvale programs.
- Responsive web and installable PWA experiences.
- English, Spanish, and Vietnamese interface copy.
- Optional OpenAI-assisted intake, ranking, explanation, live research, and program chat.
- A Chrome and Microsoft Edge browser-extension side panel for application guidance.

### 3.2 Not included in the current release

- Final eligibility determinations.
- Legal, financial, or case-management advice.
- Application submission on behalf of a resident.
- Resident accounts or server-side resident profiles.
- Automated signatures, attestations, uploads, consent, or verification bypass.
- Production support for cities other than Sunnyvale.
- A hosted vector database.

## 4. Primary resident journeys

### 4.1 Homepage decision tree

The homepage shall present these three primary choices prominently:

1. **What is available to me?**
   - Start an optional guided-question flow.
   - Ask for broad facts that can improve matching, such as age range, household size, income range, housing, children, employment, military connection, disability, caregiver status, utility needs, home age, and interests.
   - Permit the resident to skip individual questions or the entire questionnaire.
   - Show ranked programs based on the facts the resident chooses to provide.

2. **I know what I want**
   - Provide a free-text box for a natural-language description.
   - Accept 8 to 2,000 characters.
   - Provide example prompts without requiring a program name.
   - Extract useful profile and need information, then ask optional follow-up questions when they can materially improve results.

3. **Show all available programs**
   - Display the complete Sunnyvale catalog without requiring personal information.
   - Organize programs by city, county or regional, state, and federal level.
   - Preserve access to each program's official details and application link.

The decision tree shall be keyboard accessible, responsive, and available in English, Spanish, and Vietnamese.

### 4.2 Targeted result experience

The system shall:

- Resolve the current experience to Sunnyvale, California.
- Retrieve programs from the local index.
- Remove programs contradicted by an explicit resident fact.
- Rank the remaining records using semantic similarity and structured matching signals.
- Return up to five direct matches and up to three adjacent discoveries.
- Label adjacent discoveries as additional programs worth knowing about.
- Display the official source, application link, benefit summary, published eligibility text, relevance explanation, and last-checked date.
- State that program administrators make final eligibility decisions.

### 4.3 Browse-all experience

The browse view shall:

- Show all active Sunnyvale records.
- Group records by government or administrative level.
- Show the number of programs in each group.
- Allow a resident to open the program guide or official program page from every record.
- Offer a path into the guided-question flow.

### 4.4 Per-program guide

Every program result shall provide an **Explore this** action that opens an accessible same-page guide.

The guide shall:

- Keep a separate conversation for each program during the browser session.
- Answer questions about published eligibility, benefits, documents, deadlines, costs, application steps, and verified contacts.
- Search current official or trusted program sources for every answer.
- Display clickable sources.
- Ask one focused, optional, non-sensitive follow-up question only when the answer depends on an additional resident fact.
- Avoid repeating questions already answered in the current conversation.
- State only supported facts and stop; it shall not list or describe facts that are unknown, missing, omitted, or not provided.
- When a resident skips a follow-up, state the published general rules without explaining which personal facts were not supplied.
- Recommend a verified official website or phone number only when the published sources do not answer the question or the program administrator must resolve a case-specific issue.
- Never claim that the resident definitely qualifies.

### 4.5 Guided application handoff

Each program shall provide an **Apply with BenefitBeacon** action that:

- Opens the official application or program URL in a new tab.
- Sends the selected program, constrained profile, and bounded program conversation to the installed browser extension.
- Shows a clear message explaining how to open the extension side panel.
- Keeps API credentials on the server.

## 5. Browser-extension requirements

The browser extension shall:

- Use Chrome Manifest V3 and a side-panel interface.
- Support Google Chrome and Microsoft Edge.
- Request access to an external HTTPS origin only after the resident chooses to connect that site.
- Read visible field labels, field types, select options, required status, and empty or completed state.
- Never return entered field values to the side panel or server.
- Highlight a selected field on the application page.
- Explain a field using the existing source-grounded program guide.
- Offer deterministic suggestions only for safe, coarse profile fields.
- Require explicit confirmation before filling each suggested value.
- Never fill passwords, Social Security or tax identifiers, bank or account information, PINs, passcodes, signatures, identity-document numbers, full birth dates, or file inputs.
- Never submit a form, sign, accept terms, upload a document, bypass verification, or automatically advance the application.
- Continue offering chat and the official link when a protected embedded form cannot be inspected.

## 6. Program-data requirements

### 6.1 Source of truth

The curated program source shall be `data/programs.seed.json`. Local seed tooling shall validate it, generate deterministic embeddings and SQL, and load the local D1 or SQLite database.

### 6.2 Required program fields

Every active program record shall contain:

- Stable program ID.
- Program name.
- Administrative level and jurisdiction.
- Sunnyvale city scope.
- Category.
- Plain-language summary.
- Benefit description.
- Published eligibility text.
- Official application URL.
- Official source URL and label.
- Source excerpt or evidence.
- Last-checked date.
- Audience and interest tags.
- Relevant structured eligibility constraints.
- Precomputed local embedding.
- Active status.

### 6.3 Data quality

- Official and application URLs shall use HTTPS.
- Each result shall retain its source and freshness date.
- Duplicate records shall be rejected.
- Expired or inactive programs shall not be shown as active.
- Program facts shall be refreshed from authoritative sources before a public demonstration.
- AI output shall never overwrite the curated local program index.

## 7. Matching requirements

The normal matching path shall:

1. Query active programs serving Sunnyvale.
2. Apply hard contradiction filters using only explicit resident facts.
3. Compute local semantic similarity using the precomputed embedding scheme.
4. Add structured boosts for stated needs, audience, jurisdiction, and applicable income targeting.
5. Create a bounded candidate pool.
6. Optionally use AI to reorder only the supplied candidate IDs and write relevance explanations.
7. Reject AI-returned IDs not present in the candidate pool.
8. Fall back to deterministic ordering and templated explanations when AI is unavailable.

Relevance scores shall be treated as ranking signals, not eligibility probabilities.

## 8. AI requirements and boundaries

### 8.1 Intake extraction

- Trigger: submission of the natural-language situation.
- Input: length-limited text after sensitive-pattern redaction.
- Output: a strict structured resident profile and optional follow-up questions.
- Fallback: deterministic local extraction.

### 8.2 Indexed ranking and explanation

- Input: derived Sunnyvale geography, constrained profile, and bounded indexed records.
- Output: candidate record IDs, direct or related classification, relevance score, and explanation.
- The model shall not add programs, URLs, benefits, amounts, deadlines, or eligibility conditions.
- Relevance explanations shall use only supplied facts and shall not inventory absent resident details.

### 8.3 Optional live discovery

- Live discovery shall run only after explicit resident action.
- Search shall be restricted to approved government, regulated-utility, and program-administrator domains.
- Candidate records shall require a consulted authoritative source.
- Returned URLs shall be HTTPS and pass host validation.
- Failure shall not remove or replace the indexed results already shown.

### 8.4 Program chat

- The program record shall be retrieved or validated server-side.
- Web search shall be required for each substantive answer.
- Recent history shall be bounded.
- Only allowlisted coarse profile fields shall be sent.
- The assistant shall not request or repeat sensitive identifiers.
- The assistant shall not state that resident facts are unknown or missing.
- Responses shall pass through a server-side policy filter that removes such statements before display.

### 8.5 Model configuration

- `OPENAI_API_KEY` shall remain server-side and optional for the core indexed flow.
- `OPENAI_MODEL` shall configure intake and indexed ranking.
- `OPENAI_DISCOVERY_MODEL` may override the model for optional live discovery.
- `OPENAI_PROGRAM_CHAT_MODEL` may override the model for program chat.
- Model failure shall produce a plain-language, non-destructive fallback.

## 9. Privacy and security requirements

- No account shall be required.
- The application shall not maintain a server-side resident-profile database.
- Resident profile state shall remain in device-session storage.
- Common sensitive identifiers, email addresses, phone numbers, and street-address patterns shall be redacted before hosted intake calls.
- The original free-text story shall not be sent to the discovery endpoint.
- Discovery shall receive only constrained profile fields and derived geography.
- Street addresses used for geocoding shall be discarded and shall not be sent to OpenAI.
- API keys shall never appear in client or extension bundles.
- Server endpoints shall apply request-size validation, source validation, and rate limits.
- Local SQLite shall contain public program information only.
- External links shall open safely with appropriate browser isolation attributes.

## 10. Accessibility requirements

The resident-facing web and extension interfaces shall:

- Target WCAG 2.2 AA practices.
- Use large, readable typography and high-contrast colors.
- Provide at least 44-by-44-pixel interactive targets where practical.
- Support keyboard navigation and visible focus indicators.
- Include a skip link and meaningful landmarks.
- Provide accessible labels for controls and dialogs.
- Trap focus within the open program-guide drawer and close it with Escape.
- Announce loading, errors, and dynamic results with appropriate live regions.
- Support reduced-motion preferences.
- Provide an extra-large-text control and a high-contrast control.
- Avoid color as the only way to communicate status.
- Remain usable on narrow mobile screens and at browser zoom.

## 11. PWA and responsive requirements

- The web application shall support current desktop and mobile browsers.
- The primary journeys shall work at mobile, tablet, and desktop widths.
- The application shall include an installable web manifest.
- A service worker shall cache the application shell without caching sensitive resident data.
- Print or save-to-PDF output shall omit navigation, chat overlays, application handoff notices, and interactive controls.

## 12. Reliability and failure behavior

| Failure | Required behavior |
|---|---|
| OpenAI intake unavailable | Continue with the local extractor and optional questions. |
| AI ranking unavailable | Continue with deterministic local ranking. |
| Live discovery unavailable | Preserve indexed results and show a non-destructive message. |
| Program chat unavailable | Keep indexed program details, official sources, and application links accessible. |
| Local database unavailable | Show an operator-oriented setup error; do not invent results. |
| Address geocoding unavailable | Continue with city or ZIP when available. |
| Browser extension not installed | Open the official application and explain that guided side-panel help requires the extension. |
| Protected application frame | Keep side-panel chat and official navigation available without inspecting the frame. |

## 13. Performance requirements

- The local indexed path shall not depend on live web search.
- Retrieval shall scan only the bounded local corpus.
- The UI shall show an immediate loading state for network-backed operations.
- API calls shall use bounded histories, candidate pools, output sizes, and search calls.
- Images shall use appropriately sized local assets.
- The application shall avoid a hosted vector database at the current corpus size.

## 14. Observability and maintainability

- Errors returned to residents shall use plain language and avoid implementation terminology.
- Server logs shall not include raw resident stories, sensitive values, or API keys.
- Environment variables shall be documented in `.env.example`.
- Architecture and AI boundaries shall remain documented in `ARCHITECTURE_AND_TECHNICAL_DESIGN.md` and `BENEFITBEACON_TECHNICAL_SPEC.md`.
- The program refresh process shall validate data, regenerate embeddings and SQL, reseed the database, and rerun automated checks.

## 15. Acceptance criteria

The current release is acceptable when:

1. The homepage displays all three decision-tree choices and each choice opens the correct journey.
2. Guided questions are optional and can be skipped.
3. Natural-language intake works with both hosted extraction and the local fallback.
4. Browse-all displays the full active Sunnyvale catalog grouped by level.
5. Targeted results use only indexed records and retain official links and last-checked dates.
6. AI ranking cannot introduce an unindexed program or source.
7. Program chat searches authoritative sources and displays clickable evidence.
8. Program chat does not display statements that inventory unknown or unprovided resident details.
9. Indexed discovery continues to work when OpenAI or live search is unavailable.
10. The extension never reads entered values, fills blocked sensitive fields, or submits an application.
11. Core journeys are usable with keyboard-only navigation and on a mobile-width screen.
12. English, Spanish, and Vietnamese interface choices render without breaking the primary flows.
13. The production build, lint checks, and automated test suite pass.
14. The local application responds successfully at its configured address.

## 16. Success measures

For a pilot or demonstration, track:

- Percentage of residents who reach at least one official program page.
- Percentage who complete one of the three homepage paths.
- Number of program-guide questions answered with authoritative sources.
- Number of application handoffs initiated.
- Follow-up-question skip and completion rates.
- Search and chat error rates.
- Accessibility defects found during keyboard and screen-reader review.

These measures shall not require storing sensitive resident details.
