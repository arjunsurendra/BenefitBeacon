import { programs } from "@/data/programs";
import {
  allowedDomainsFor,
  cleanLocationInput,
  geographyCacheKey,
  geographyFromCensus,
  localGeography,
  looksLikeStreetAddress,
  validateDiscoveredPrograms,
} from "@/lib/discovery";
import type { DiscoveryResponse, Geography, UserProfile } from "@/lib/types";

export const runtime = "edge";

const requestWindow = new Map<string, { count: number; resetAt: number }>();
const discoveryCache = new Map<string, { expiresAt: number; research: string; citations: string[] }>();
const windowMs = 60_000;
const maxRequests = 6;
const cacheMs = 24 * 60 * 60 * 1_000;

const candidateSchema = {
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
        required: ["name", "level", "jurisdiction", "category", "summary", "benefit", "eligibilityText", "applyUrl", "sourceUrl", "sourceLabel", "sourceSnippet", "relevanceReason", "relevanceScore"],
      },
    },
  },
  required: ["candidates"],
} as const;

type ResponsePayload = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{ type?: string; url?: string; title?: string }>;
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

function citationUrls(payload: ResponsePayload) {
  return [...new Set(outputParts(payload).flatMap((part) => part.annotations ?? []).filter((item) => item.type === "url_citation" && item.url).map((item) => item.url as string))];
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
  if (error.status === 401) return Response.json({ error: "The OpenAI API key was rejected. Replace OPENAI_API_KEY in .env.local with a valid key, then restart the local server." }, { status: 503 });
  if (error.status === 403) return Response.json({ error: "This OpenAI project does not have access to the configured discovery model or web search." }, { status: 503 });
  if (error.status === 429) return Response.json({ error: "The OpenAI project has reached a rate or usage limit. Check project billing and limits, then try again." }, { status: 429 });
  return Response.json({ error: `OpenAI rejected the discovery request (HTTP ${error.status}). Check the configured model and project access.` }, { status: 502 });
}

function safeProfile(value: unknown): UserProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const allowed = new Set(["zip", "city", "state", "ageRange", "householdSize", "childrenAges", "incomeBand", "housing", "veteran", "activeDuty", "disabled", "caregiver", "employment", "homeAgeYears", "hasHighWaterBill", "interests", "language"]);
  return Object.fromEntries(Object.entries(input).filter(([key, item]) => allowed.has(key) && (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || Array.isArray(item)))) as UserProfile;
}

export async function POST(request: Request) {
  if (rateLimited(requestId(request))) return Response.json({ error: "Please wait a minute before searching again." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { location?: unknown; profile?: unknown } | null;
  if (!body || typeof body.location !== "string") return Response.json({ error: "Enter a city, ZIP code, or U.S. street address." }, { status: 400 });
  const location = cleanLocationInput(body.location);
  if (location.length < 2) return Response.json({ error: "Enter a city, ZIP code, or U.S. street address." }, { status: 400 });

  let resolved: { geography: Geography; addressDiscarded: boolean };
  try {
    resolved = await resolveGeography(location);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "LOCATION_NOT_FOUND" ? "That address could not be matched. Try a city and state or a ZIP code." : code === "GEOCODER_UNAVAILABLE" ? "The Census address service is temporarily unavailable. Try a city and state." : "Enter a valid city, state, ZIP code, or U.S. address.";
    return Response.json({ error: message }, { status: code === "GEOCODER_UNAVAILABLE" ? 502 : 400 });
  }

  // The original location string is intentionally not retained or used below this line.
  const { geography, addressDiscarded } = resolved;
  const cacheKey = geographyCacheKey(geography);
  const cachedResearch = discoveryCache.get(cacheKey);
  const profile = safeProfile(body.profile);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "Live discovery is not configured. Add OPENAI_API_KEY to .env.local." }, { status: 503 });
  const model = process.env.OPENAI_DISCOVERY_MODEL || process.env.OPENAI_MODEL || "gpt-6-luna";
  const domains = allowedDomainsFor(geography);
  const place = [geography.city, geography.county, geography.state, geography.zip ? `ZIP ${geography.zip}` : undefined].filter(Boolean).join(", ");

  try {
    let searchText = cachedResearch?.expiresAt && cachedResearch.expiresAt > Date.now() ? cachedResearch.research : "";
    let citations = cachedResearch?.expiresAt && cachedResearch.expiresAt > Date.now() ? cachedResearch.citations : [];
    const usedCachedResearch = Boolean(searchText && citations.length);
    if (!usedCachedResearch) {
      const search = await openAIResponse(apiKey, {
        model,
        reasoning: { effort: "low" },
        instructions: [
          "Find currently available public-benefit, rebate, discount, assistance, and community-support programs for the specified geography.",
          "Cover food, health, housing, utilities, family, disability, caregiver, employment, transportation, senior, and veteran needs.",
          "Prioritize city and county programs that a general benefits directory may miss, then state and federal programs.",
          "Use only the allowed official government or established public-agency domains. Cite every program claim with its source URL.",
          "Do not decide whether a person qualifies. Do not invent eligibility rules, deadlines, amounts, or URLs.",
        ].join(" "),
        input: `Search for active programs serving residents of ${place}. Find up to 16 useful programs across the major assistance categories and include official application and eligibility pages.`,
        tools: [{
          type: "web_search",
          filters: { allowed_domains: domains },
          user_location: { type: "approximate", city: geography.city, region: geography.stateCode, country: "US", timezone: "America/Los_Angeles" },
          search_context_size: "high",
        }],
        tool_choice: "auto",
        max_output_tokens: 5_000,
      });
      searchText = outputText(search);
      citations = citationUrls(search);
      if (!searchText || citations.length === 0) throw new Error("NO_SOURCES");
      discoveryCache.set(cacheKey, { expiresAt: Date.now() + cacheMs, research: searchText, citations });
    }

    const extraction = await openAIResponse(apiKey, {
      model,
      reasoning: { effort: "low" },
      instructions: [
        "Convert the supplied official-source research into structured program candidates.",
        "Include a program only when its source URL appears in the supplied citation URL list.",
        "Rank candidates by relevance to the resident profile using only explicitly provided profile fields.",
        "Write a short relevanceReason that names the provided fact connected to the program, without saying the resident qualifies.",
        "Set relevanceScore from 0 to 100 as a relevance ranking, not an eligibility probability. Omit low-relevance candidates.",
        "Summarize the source conservatively. Eligibility text is informational and must never claim that this resident qualifies.",
        "Return an empty candidates array when the evidence is insufficient.",
      ].join(" "),
      input: JSON.stringify({ geography, residentProfile: profile, research: searchText, citationUrls: citations }),
      text: { format: { type: "json_schema", name: "benefitbeacon_live_discovery", strict: true, schema: candidateSchema } },
      max_output_tokens: 3_500,
    });
    const extractedText = outputText(extraction);
    if (!extractedText) throw new Error("NO_EXTRACTION");
    const parsed = JSON.parse(extractedText) as { candidates?: Parameters<typeof validateDiscoveredPrograms>[0] };
    const searchedAt = new Date().toISOString();
    const candidates = validateDiscoveredPrograms(parsed.candidates ?? [], domains, citations, programs, searchedAt);
    const result: DiscoveryResponse = { geography, candidates, mode: "openai", model, searchedAt, cacheKey, cached: usedCachedResearch, addressDiscarded };
    return Response.json(result);
  } catch (error) {
    const providerError = providerErrorResponse(error);
    if (providerError) return providerError;
    return Response.json({ error: "Live program discovery is temporarily unavailable. Your curated matches are still available." }, { status: 502 });
  }
}
