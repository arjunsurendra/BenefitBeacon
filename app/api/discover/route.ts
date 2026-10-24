import {
  allowedDomainsFor,
  cleanLocationInput,
  discoveryProfileSignals,
  discoveryTopics,
  geographyCacheKey,
  geographyFromCensus,
  localGeography,
  looksLikeStreetAddress,
  searchDomainsFor,
  validateDiscoveredPrograms,
} from "@/lib/discovery";
import { capRankedPrograms, listIndexedPrograms, retrieveIndexedPrograms, type IndexedCandidate } from "@/lib/indexed-programs";
import { omitUnknownStatements } from "@/lib/response-policy";
import type { DiscoveredProgram, DiscoveryResponse, Geography, UserProfile } from "@/lib/types";

export const runtime = "edge";

const requestWindow = new Map<string, { count: number; resetAt: number }>();
const discoveryCache = new Map<string, { expiresAt: number; research: string; citations: string[] }>();
const windowMs = 60_000;
const maxRequests = 12;
const cacheMs = 24 * 60 * 60 * 1_000;

const liveCandidateSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          matchType: { type: "string", enum: ["direct", "related"] },
          name: { type: "string", maxLength: 140 },
          level: { type: "string", enum: ["city", "county", "state", "federal"] },
          jurisdiction: { type: "string", maxLength: 100 },
          category: { type: "string", enum: ["food", "health", "utilities", "home", "veterans", "family", "transportation", "other"] },
          summary: { type: "string", maxLength: 360 },
          benefit: { type: "string", maxLength: 180 },
          eligibilityText: { type: "string", maxLength: 360 },
          applyUrl: { type: "string" },
          sourceUrl: { type: "string" },
          sourceLabel: { type: "string", maxLength: 120 },
          sourceSnippet: { type: "string", maxLength: 320 },
          relevanceReason: { type: "string", maxLength: 260 },
          relevanceScore: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["matchType", "name", "level", "jurisdiction", "category", "summary", "benefit", "eligibilityText", "applyUrl", "sourceUrl", "sourceLabel", "sourceSnippet", "relevanceReason", "relevanceScore"],
      },
    },
  },
  required: ["candidates"],
} as const;

const rankingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ranked: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          matchType: { type: "string", enum: ["direct", "related"] },
          relevanceScore: { type: "integer", minimum: 0, maximum: 100 },
          relevanceReason: { type: "string", maxLength: 260 },
        },
        required: ["id", "matchType", "relevanceScore", "relevanceReason"],
      },
    },
  },
  required: ["ranked"],
} as const;

type ResponsePayload = {
  output?: Array<{
    action?: { sources?: Array<{ url?: string }> };
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{ type?: string; url?: string }>;
    }>;
  }>;
};

class OpenAIRequestError extends Error {
  constructor(readonly status: number) {
    super(`OPENAI_${status}`);
  }
}

function requestId(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
}

function rateLimited(id: string): boolean {
  const now = Date.now();
  const current = requestWindow.get(id);
  if (!current || current.resetAt <= now) {
    requestWindow.set(id, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > maxRequests;
}

function outputParts(payload: ResponsePayload) {
  return payload.output?.flatMap((item) => item.content ?? []).filter((part) => part.type === "output_text") ?? [];
}

function outputText(payload: ResponsePayload) {
  return outputParts(payload).map((part) => part.text ?? "").join("");
}

function consultedUrls(payload: ResponsePayload) {
  const citations = outputParts(payload).flatMap((part) => part.annotations ?? []).filter((item) => item.type === "url_citation" && item.url).map((item) => item.url as string);
  const sources = payload.output?.flatMap((item) => item.action?.sources ?? []).map((source) => source.url).filter((url): url is string => Boolean(url)) ?? [];
  return [...new Set([...citations, ...sources])];
}

async function resolveGeography(input: string): Promise<{ geography: Geography; addressDiscarded: boolean }> {
  if (!looksLikeStreetAddress(input)) {
    const geography = localGeography(input);
    if (!geography) throw new Error("LOCATION_INVALID");
    return { geography, addressDiscarded: false };
  }
  const endpoint = new URL("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
  endpoint.searchParams.set("address", input);
  endpoint.searchParams.set("benchmark", "Public_AR_Current");
  endpoint.searchParams.set("vintage", "Current_Current");
  endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("GEOCODER_UNAVAILABLE");
  const geography = geographyFromCensus(await response.json());
  if (!geography) throw new Error("LOCATION_NOT_FOUND");
  return { geography, addressDiscarded: true };
}

async function openAIResponse(apiKey: string, body: Record<string, unknown>): Promise<ResponsePayload> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new OpenAIRequestError(response.status);
  return response.json() as Promise<ResponsePayload>;
}

function providerErrorResponse(error: unknown) {
  if (!(error instanceof OpenAIRequestError)) return null;
  if (error.status === 401) return Response.json({ error: "We could not check for updates right now. Your program list is still available." }, { status: 503 });
  if (error.status === 429) return Response.json({ error: "The update check is busy. Your program list is still available." }, { status: 429 });
  return Response.json({ error: "We could not check for updates right now. Your program list is still available." }, { status: 502 });
}

function safeProfile(value: unknown): UserProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const allowed = new Set(["zip", "city", "state", "ageRange", "householdSize", "childrenAges", "incomeBand", "housing", "veteran", "activeDuty", "disabled", "caregiver", "employment", "homeAgeYears", "hasHighWaterBill", "interests", "language"]);
  return Object.fromEntries(Object.entries(input).filter(([key, item]) => allowed.has(key) && (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || Array.isArray(item)))) as UserProfile;
}

function withoutRetrievalScore(candidate: IndexedCandidate): DiscoveredProgram {
  const copy = { ...candidate } as IndexedCandidate & { retrievalScore?: number };
  delete copy.retrievalScore;
  return copy;
}

async function rankIndexedCandidates(apiKey: string, model: string, geography: Geography, profile: UserProfile, pool: IndexedCandidate[]): Promise<DiscoveredProgram[] | null> {
  try {
    const payload = await openAIResponse(apiKey, {
      model,
      reasoning: { effort: "low" },
      instructions: [
        "Rank only the supplied BenefitBeacon program records; never add a program, URL, benefit, amount, or eligibility rule.",
        "Use only facts explicitly present in the resident profile.",
        "Never mention an absent, omitted, missing, or unknown resident detail. State only the positive relevance supported by supplied facts and the program record.",
        "Use matchType direct only when a record addresses an explicitly stated need. When the resident stated no need category, a clearly supplied profile fact may support a direct result.",
        "Use matchType related for a high-value adjacent benefit supported by a supplied profile fact or unusually strong city relevance but not by the stated need.",
        "Return up to five direct matches and three related discoveries. Relevance scores rank usefulness and are not eligibility probabilities.",
        "Explain the specific resident fact that makes each record relevant without claiming the person qualifies.",
        "Omit weak or contradictory records. Program administrators make final eligibility decisions.",
      ].join(" "),
      input: JSON.stringify({
        geography,
        residentProfile: profile,
        candidates: pool.map(withoutRetrievalScore),
      }),
      text: { format: { type: "json_schema", name: "benefitbeacon_index_ranking", strict: true, schema: rankingSchema } },
      max_output_tokens: 1_800,
    });
    const text = outputText(payload);
    if (!text) return null;
    const parsed = JSON.parse(text) as { ranked?: Array<{ id: string; matchType: "direct" | "related"; relevanceScore: number; relevanceReason: string }> };
    const byId = new Map(pool.map((candidate) => [candidate.id, candidate]));
    const seen = new Set<string>();
    const ranked = (parsed.ranked ?? []).flatMap((item) => {
      const candidate = byId.get(item.id);
      if (!candidate || seen.has(item.id) || !item.relevanceReason.trim()) return [];
      seen.add(item.id);
      const program = withoutRetrievalScore(candidate);
      const filteredReason = omitUnknownStatements(item.relevanceReason).text;
      const reason = filteredReason && /[.!?]$/.test(filteredReason) ? filteredReason : candidate.relevanceReason;
      return [{ ...program, matchType: item.matchType, relevanceScore: item.relevanceScore, relevanceReason: reason }];
    });
    return capRankedPrograms(ranked);
  } catch {
    return null;
  }
}

async function indexedResponse(geography: Geography, addressDiscarded: boolean, profile: UserProfile): Promise<DiscoveryResponse> {
  const { candidates: pool, indexedCount } = await retrieveIndexedPrograms(geography, profile);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-6-luna";
  const aiRanked = apiKey && pool.length ? await rankIndexedCandidates(apiKey, model, geography, profile, pool) : null;
  const fallbackRanked = capRankedPrograms(pool.map(withoutRetrievalScore));
  const searchedAt = new Date().toISOString();
  return {
    geography,
    candidates: aiRanked?.length ? aiRanked : fallbackRanked,
    mode: aiRanked?.length ? "indexed-ai" : "indexed",
    model: aiRanked?.length ? model : undefined,
    searchedAt,
    cacheKey: geographyCacheKey(geography),
    cached: true,
    addressDiscarded,
    indexedCount,
    fallbackAvailable: Boolean(apiKey),
  };
}

async function browseResponse(geography: Geography, addressDiscarded: boolean): Promise<DiscoveryResponse> {
  const candidates = await listIndexedPrograms(geography);
  return {
    geography,
    candidates,
    mode: "browse",
    searchedAt: new Date().toISOString(),
    cacheKey: geographyCacheKey(geography),
    cached: true,
    addressDiscarded,
    indexedCount: candidates.length,
    fallbackAvailable: false,
  };
}

async function liveFallbackResponse(geography: Geography, addressDiscarded: boolean, profile: UserProfile): Promise<DiscoveryResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIRequestError(401);
  const model = process.env.OPENAI_DISCOVERY_MODEL || process.env.OPENAI_MODEL || "gpt-6-luna";
  const domains = allowedDomainsFor(geography);
  const searchDomains = searchDomainsFor(geography);
  const topics = discoveryTopics(profile);
  const profileSignals = discoveryProfileSignals(profile);
  const place = [geography.city, geography.county, geography.state].filter(Boolean).join(", ");
  const researchKey = `${geographyCacheKey(geography)}|fallback|${topics.sort().join(",")}|${profileSignals.sort().join(",")}`;
  const cached = discoveryCache.get(researchKey);
  let research = cached?.expiresAt && cached.expiresAt > Date.now() ? cached.research : "";
  let citations = cached?.expiresAt && cached.expiresAt > Date.now() ? cached.citations : [];
  const usedCache = Boolean(research && citations.length);

  if (!usedCache) {
    const search = await openAIResponse(apiKey, {
      model,
      reasoning: { effort: "low" },
      instructions: [
        "Use web search only as a fallback to find currently active benefits from government, regulated utility, and direct program-administrator sources.",
        "Open and verify the strongest source pages. Exclude expired programs, generic articles, duplicates, and unsupported claims.",
        "Cite every retained program claim with a direct source URL. Do not decide eligibility or invent amounts, deadlines, rules, or URLs.",
      ].join(" "),
      input: `Find active programs serving ${place}. Prioritize: ${topics.length ? topics.join(", ") : "general essential needs"}. Consider only profile facts explicitly supplied: ${profileSignals.length ? profileSignals.join(", ") : "none"}.`,
      include: ["web_search_call.action.sources"],
      tools: [{ type: "web_search", filters: { allowed_domains: searchDomains }, user_location: { type: "approximate", city: geography.city, region: geography.stateCode, country: "US", timezone: "America/Los_Angeles" }, search_context_size: "high" }],
      tool_choice: "required",
      max_tool_calls: 4,
      max_output_tokens: 4_000,
    });
    research = outputText(search);
    citations = consultedUrls(search);
    if (!research || !citations.length) throw new Error("NO_LIVE_SOURCES");
    discoveryCache.set(researchKey, { expiresAt: Date.now() + cacheMs, research, citations });
  }

  const extraction = await openAIResponse(apiKey, {
    model,
    reasoning: { effort: "low" },
    instructions: [
      "Convert the supplied live research into conservative structured program records.",
      "Use direct source facts only and include a program only when its source appears in the consulted URL list.",
      "Return up to five direct matches and three strongly relevant related discoveries. Do not claim that the resident qualifies.",
    ].join(" "),
    input: JSON.stringify({ geography, residentProfile: profile, research, citationUrls: citations }),
    text: { format: { type: "json_schema", name: "benefitbeacon_live_fallback", strict: true, schema: liveCandidateSchema } },
    max_output_tokens: 3_500,
  });
  const text = outputText(extraction);
  if (!text) throw new Error("NO_LIVE_EXTRACTION");
  const parsed = JSON.parse(text) as { candidates?: Parameters<typeof validateDiscoveredPrograms>[0] };
  const searchedAt = new Date().toISOString();
  return {
    geography,
    candidates: validateDiscoveredPrograms(parsed.candidates ?? [], domains, citations, searchedAt),
    mode: "live-fallback",
    model,
    searchedAt,
    cacheKey: geographyCacheKey(geography),
    cached: usedCache,
    addressDiscarded,
    indexedCount: 0,
    fallbackAvailable: true,
  };
}

export async function POST(request: Request) {
  if (rateLimited(requestId(request))) return Response.json({ error: "Please wait a minute before searching again." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { location?: unknown; profile?: unknown; liveFallback?: unknown; browseAll?: unknown } | null;
  if (!body || typeof body.location !== "string") return Response.json({ error: "Enter Sunnyvale or a Sunnyvale ZIP code or street address." }, { status: 400 });
  const location = cleanLocationInput(body.location);
  if (location.length < 2) return Response.json({ error: "Enter Sunnyvale or a Sunnyvale ZIP code or street address." }, { status: 400 });

  let resolved: { geography: Geography; addressDiscarded: boolean };
  try {
    resolved = await resolveGeography(location);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "LOCATION_NOT_FOUND" ? "That address could not be matched. Try Sunnyvale or a Sunnyvale ZIP code." : code === "GEOCODER_UNAVAILABLE" ? "The address service is temporarily unavailable. Try Sunnyvale, CA." : "Enter a valid Sunnyvale ZIP code or address.";
    return Response.json({ error: message }, { status: code === "GEOCODER_UNAVAILABLE" ? 502 : 400 });
  }

  if (resolved.geography.city?.toLowerCase() !== "sunnyvale") {
    return Response.json({ error: "BenefitBeacon currently serves Sunnyvale residents." }, { status: 400 });
  }

  const profile = safeProfile(body.profile);
  try {
    const result = body.browseAll === true
      ? await browseResponse(resolved.geography, resolved.addressDiscarded)
      : body.liveFallback === true
        ? await liveFallbackResponse(resolved.geography, resolved.addressDiscarded, profile)
        : await indexedResponse(resolved.geography, resolved.addressDiscarded, profile);
    return Response.json(result);
  } catch (error) {
    const providerError = providerErrorResponse(error);
    if (providerError) return providerError;
    if (body.liveFallback === true) return Response.json({ error: "We could not check for updates right now. Your program list is still available." }, { status: 502 });
    return Response.json({ error: "Program information is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
