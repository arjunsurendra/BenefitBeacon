import type { DiscoveredProgram, Geography, Program } from "@/lib/types";

export const officialDomains = [
  "usa.gov",
  "benefits.gov",
  "ca.gov",
  "benefitscal.com",
  "coveredca.com",
  "medicare.gov",
  "ssa.gov",
  "va.gov",
  "hud.gov",
  "hhs.gov",
  "usda.gov",
  "energy.gov",
  "fcc.gov",
  "ed.gov",
  "santaclaracounty.gov",
  "sccgov.org",
  "sunnyvale.ca.gov",
  "sanjoseca.gov",
  "santaclaraca.gov",
  "mountainview.gov",
  "cupertino.gov",
  "milpitas.gov",
  "campbellca.gov",
  "losaltosca.gov",
  "saratoga.ca.us",
  "morganhill.ca.gov",
  "cityofgilroy.org",
  "valleywater.org",
] as const;

const cityDomains: Record<string, string> = {
  sunnyvale: "sunnyvale.ca.gov",
  "san jose": "sanjoseca.gov",
  "santa clara": "santaclaraca.gov",
  "mountain view": "mountainview.gov",
  cupertino: "cupertino.gov",
  milpitas: "milpitas.gov",
  campbell: "campbellca.gov",
  "los altos": "losaltosca.gov",
  saratoga: "saratoga.ca.us",
  "morgan hill": "morganhill.ca.gov",
  gilroy: "cityofgilroy.org",
};

const santaClaraCities = new Set(Object.keys(cityDomains));

export function cleanLocationInput(input: string): string {
  return input.trim().replace(/\s+/g, " ").slice(0, 180);
}

export function looksLikeStreetAddress(input: string): boolean {
  return /^\d{1,8}\s+\S+/i.test(cleanLocationInput(input));
}

export function localGeography(input: string): Geography | null {
  const clean = cleanLocationInput(input);
  const zip = clean.match(/^\d{5}(?:-\d{4})?$/)?.[0]?.slice(0, 5);
  if (zip) return { label: `ZIP ${zip}`, zip, state: "California", stateCode: "CA" };
  if (looksLikeStreetAddress(clean)) return null;

  const parts = clean.split(",").map((part) => part.trim()).filter(Boolean);
  const rawCity = parts[0]?.replace(/[^a-zA-ZÀ-ÿ.' -]/g, "").trim();
  if (!rawCity || rawCity.length < 2) return null;
  const city = rawCity.toLowerCase();
  const stateCode = (parts[1]?.match(/\b[A-Za-z]{2}\b/)?.[0] ?? "CA").toUpperCase();
  const county = santaClaraCities.has(city) && stateCode === "CA" ? "Santa Clara County" : undefined;
  const displayCity = city.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    label: [displayCity, county, stateCode].filter(Boolean).join(", "),
    city: displayCity,
    county,
    state: stateCode === "CA" ? "California" : stateCode,
    stateCode,
  };
}

type CensusGeography = { NAME?: string; BASENAME?: string; CD119?: string; STATE?: string };
type CensusPayload = {
  result?: {
    addressMatches?: Array<{
      addressComponents?: { city?: string; state?: string; zip?: string };
      geographies?: Record<string, CensusGeography[]>;
    }>;
  };
};

function firstGeography(groups: Record<string, CensusGeography[]> | undefined, pattern: RegExp) {
  const entry = Object.entries(groups ?? {}).find(([name]) => pattern.test(name));
  return entry?.[1]?.[0];
}

export function geographyFromCensus(payload: CensusPayload): Geography | null {
  const match = payload.result?.addressMatches?.[0];
  if (!match) return null;
  const components = match.addressComponents ?? {};
  const countyRecord = firstGeography(match.geographies, /counties/i);
  const stateRecord = firstGeography(match.geographies, /^states$/i);
  const districtRecord = firstGeography(match.geographies, /congressional districts/i);
  const city = components.city?.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  const countyBase = countyRecord?.BASENAME ?? countyRecord?.NAME?.split(",")[0];
  const county = countyBase ? (countyBase.toLowerCase().includes("county") ? countyBase : `${countyBase} County`) : undefined;
  const stateCode = components.state?.toUpperCase();
  const state = stateRecord?.BASENAME ?? stateRecord?.NAME?.split(",")[0] ?? stateCode;
  const congressionalDistrict = districtRecord?.CD119 ?? districtRecord?.BASENAME;
  const zip = components.zip?.slice(0, 5);
  const label = [city, county, stateCode, zip].filter(Boolean).join(", ");
  return label ? { label, city, county, state, stateCode, zip, congressionalDistrict } : null;
}

export function geographyCacheKey(geography: Geography): string {
  return [geography.city, geography.county, geography.stateCode, geography.zip]
    .filter(Boolean)
    .join("|")
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, "-");
}

export function allowedDomainsFor(geography: Geography): string[] {
  const city = geography.city?.toLowerCase();
  const preferred = city ? cityDomains[city] : undefined;
  return [...new Set(preferred ? [preferred, ...officialDomains] : officialDomains)];
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function isAllowedOfficialUrl(value: string, domains: readonly string[]): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = normalizeHostname(url.hostname);
    return domains.some((domain) => hostname === normalizeHostname(domain) || hostname.endsWith(`.${normalizeHostname(domain)}`));
  } catch {
    return false;
  }
}

function cleanUrl(value: string): string {
  const url = new URL(value);
  [...url.searchParams.keys()].filter((key) => key.toLowerCase().startsWith("utm_")).forEach((key) => url.searchParams.delete(key));
  url.hash = "";
  return url.toString();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70);
}

type RawCandidate = Omit<DiscoveredProgram, "id" | "discoveredAt" | "status">;

export function validateDiscoveredPrograms(
  candidates: RawCandidate[],
  domains: readonly string[],
  citations: readonly string[],
  curated: readonly Program[],
  discoveredAt: string,
): DiscoveredProgram[] {
  const cited = new Set(citations.filter((url) => isAllowedOfficialUrl(url, domains)).map(cleanUrl));
  const existingNames = new Set(curated.map((program) => slug(program.name)));
  const existingUrls = new Set(curated.flatMap((program) => [program.sourceUrl, program.applyUrl]).map((url) => cleanUrl(url)));
  const seen = new Set<string>();

  return candidates.flatMap((candidate) => {
    if (!candidate?.name || !candidate.sourceUrl || !candidate.summary || !candidate.eligibilityText) return [];
    if (!isAllowedOfficialUrl(candidate.sourceUrl, domains)) return [];
    const sourceUrl = cleanUrl(candidate.sourceUrl);
    const isCited = cited.has(sourceUrl) || [...cited].some((citation) => {
      try { return new URL(citation).hostname === new URL(sourceUrl).hostname; } catch { return false; }
    });
    if (!isCited || existingUrls.has(sourceUrl)) return [];
    const nameKey = slug(candidate.name);
    if (!nameKey || seen.has(nameKey) || existingNames.has(nameKey)) return [];
    seen.add(nameKey);

    const applyUrl = isAllowedOfficialUrl(candidate.applyUrl, domains) ? cleanUrl(candidate.applyUrl) : sourceUrl;
    return [{
      ...candidate,
      id: `discovered-${nameKey}`,
      applyUrl,
      sourceUrl,
      discoveredAt,
      status: "unverified" as const,
    }];
  }).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 8);
}
