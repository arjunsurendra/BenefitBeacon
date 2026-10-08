# BenefitBeacon — Refined Technical Specification

## Product thesis

BenefitBeacon is a local benefits navigation system with a deliberately narrow AI trust boundary. The model may understand language and produce explanations, but it may not determine eligibility. Every recommendation is reproducible from a versioned program record, a structured resident profile, and an auditable rule trace.

## System design

```text
Single free-text intake
          |
          v
PII firewall (server-side regex + input limits)
          |
          +---- OpenAI structured extraction ----------+
          |      gpt-6-luna + strict JSON Schema        |
          +---- local extractor fallback ---------------+
                              v
                    Normalized UserProfile
                              |
                  Optional missing-field questions
                              |
                    Deterministic rule graph
                              |
                EligibilityResult + audit trace
                              |
                  Program-scoped evidence retrieval
                              |
                 Grounded UI + official citations
```

Live discovery joins the same flow after optional follow-ups:

```text
Structured profile + city / ZIP
        |
                              derived geography only
                                                      |
                                 official-domain web search
                                                      |
                         profile-aware structured ranking
                                                      |
                            HTTPS + citation + duplicate validation
                                                      |
                         "Eligibility not evaluated" result cards
```

## AI architecture

### 1. Constrained intake extraction

The server uses the OpenAI Responses API and strict Structured Outputs. Every profile property is required by the schema but nullable, preventing the model from silently omitting fields. The prompt forbids inference of sensitive attributes and instructs the model to return broad bands instead of exact income or age values.

The default model is `gpt-6-luna`, selected for low-latency, cost-efficient structured extraction. The model is configurable with `OPENAI_MODEL`; production snapshots should be pinned after evaluation.

### 2. Confidence and abstention

The extractor emits a calibrated confidence value and up to three follow-up questions. Missing fields remain unknown. The rules engine maps incomplete evidence to `maybe` rather than inventing an answer. The UI exposes extraction confidence and the most valuable follow-up question.

### 3. Deterministic policy engine

Programs use declarative rules. Each operator is pure and unit-tested. Results contain matched rules, failed rules, and missing fields. Ranking combines eligibility state, program impact, and evidence coverage, while status remains strictly rule-derived.

### 4. Evidence-scoped retrieval

The first version uses a local lexical retriever over program names, categories, summaries, and cached official snippets. Retrieval is scoped to curated evidence, so open-ended questions cannot introduce unsupported URLs or amounts. A production extension can add embeddings and reranking while preserving this same source allowlist.

### 5. Grounded explanation contract

Result copy is generated from the rule trace and source snippet. Future model-generated explanations must receive only the rule outcome and retrieved chunks, return claim-to-source references, and pass a URL allowlist post-check. Unsupported claims must be replaced by “check with the agency.”

### 6. Live location discovery

Discovery starts after the resident submits or skips the optional follow-up form. Each uncached geography uses two `gpt-6-luna` Responses API calls: an official-domain `web_search`, followed by strict-schema ranking against the broad structured profile. The official research is cached for 24 hours by normalized geography only; later residents reuse that research while receiving a fresh profile-aware ranking. Server validation requires HTTPS, an allowlisted host, and a matching search citation. Results already in the curated catalog are removed.

Live candidates are informational leads. They use the fixed status `unverified` and cannot enter the deterministic eligibility ranking until a human converts the source into a reviewed, versioned rule record.

## Privacy and security

- No account and no server-side resident profile storage.
- Browser state is limited to `sessionStorage` and disappears with the session.
- SSNs, likely account numbers, email addresses, phone numbers, and street addresses are replaced before any hosted provider request.
- The API key is server-side only in `OPENAI_API_KEY`.
- Hosted intake is rate-limited per edge client address.
- Inputs are capped at 2,000 characters and never logged by application code.
- Every follow-up is optional, and the entire follow-up step can be skipped.
- Live discovery starts only after the resident confirms or skips the optional questions.
- The discovery model receives only broad structured fields, never the original free-text story.

## Evaluation plan

Create a 30+ persona JSONL set divided across seniors, Veterans, families, renters, homeowners, disability pathways, and deliberately ambiguous profiles. Track:

1. field-level extraction precision, recall, and null accuracy;
2. exact eligibility status agreement with hand-labeled expectations;
3. follow-up question utility (expected information gain);
4. explanation claim support and citation correctness;
5. hallucinated URL, amount, or deadline rate—target zero;
6. latency and cost by model;
7. parity between hosted intake and the guided flow.

## Next sophistication milestones

- Versioned YAML program records with build-time schema validation.
- Nightly source-change detection with human review before publishing updates.
- Hybrid BM25 + embedding retrieval and a cross-encoder reranker.
- Claim-level citation spans and an entailment verifier.
- Counterfactual explanations: “If housing changes from rent to own, which matches change?”
- Formal policy provenance: source section, effective date, rule author, reviewer, and change history.
- Offline local-model provider behind the same `LLMProvider` interface.
