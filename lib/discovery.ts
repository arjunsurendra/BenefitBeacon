import type { DiscoveredProgram, Geography, UserProfile } from "@/lib/types";

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

export const trustedProgramDomains = [
  "svcleanenergy.org",
  "pge.com",
  "shfb.org",
  "sacredheartcs.org",
  "211bayarea.org",
  "benefitscheckup.org",
] as const;

export const trustedDiscoveryDomains = [
  "ncoa.org",
  "findhelp.org",
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

const supportedZipCities: Record<string, string> = {
  "94085": "Sunnyvale",
  "94086": "Sunnyvale",
  "94087": "Sunnyvale",
  "94089": "Sunnyvale",
  "95014": "Cupertino",
  "95015": "Cupertino",
};

export function cleanLocationInput(input: string): string {
  return input.trim().replace(/\s+/g, " ").slice(0, 180);
}

export function looksLikeStreetAddress(input: string): boolean {
  return /^\d{1,8}\s+\S+/i.test(cleanLocationInput(input));
}

export function localGeography(input: string): Geography | null {
  const clean = cleanLocationInput(input);
  const zip = clean.match(/^\d{5}(?:-\d{4})?$/)?.[0]?.slice(0, 5);
  if (zip) {
    const city = supportedZipCities[zip];
    return city
      ? { label: `${city}, Santa Clara County, CA, ${zip}`, city, county: "Santa Clara County", zip, state: "California", stateCode: "CA" }
      : { label: `ZIP ${zip}`, zip, state: "California", stateCode: "CA" };
  }
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

export function discoveryTopics(profile: UserProfile): string[] {
  const topics = new Set<string>();
  for (const value of profile.interests ?? []) {
    if (typeof value !== "string") continue;
    const topic = value.toLowerCase().replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (topic.length >= 2) topics.add(topic);
    if (topics.size === 6) break;
  }
  if (profile.hasHighWaterBill) topics.add("water and utility bill assistance");
  return [...topics];
}

export function discoveryProfileSignals(profile: UserProfile): string[] {
  const signals: string[] = [];
  if (profile.ageRange) signals.push(`age range ${profile.ageRange}`);
  if (profile.householdSize) signals.push(`household size ${profile.householdSize}`);
  if (profile.childrenAges?.length) signals.push("household with children");
  if (profile.incomeBand) signals.push(`broad income band ${profile.incomeBand}`);
  if (profile.housing) signals.push(profile.housing === "own" ? "homeowner" : profile.housing === "rent" ? "renter" : profile.housing === "unhoused" ? "without stable housing" : "other housing situation");
  if (profile.veteran) signals.push("veteran");
  if (profile.activeDuty) signals.push("active-duty military");
  if (profile.disabled) signals.push("person with a disability");
  if (profile.caregiver) signals.push("unpaid caregiver");
  if (profile.employment) signals.push(`employment status ${profile.employment}`);
  if (profile.homeAgeYears !== undefined) signals.push("home age provided");
  if (profile.hasHighWaterBill) signals.push("high utility costs");
  return signals;
}

export function discoveryResearchCacheKey(geography: Geography, profile: UserProfile): string {
  const topics = discoveryTopics(profile).map((topic) => topic.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  const signals = discoveryProfileSignals(profile).map((signal) => signal.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  return `${geographyCacheKey(geography)}|live-v4|needs:${topics.length ? topics.sort().join(",") : "general"}|profile:${signals.length ? signals.sort().join(",") : "none"}`;
}

export function allowedDomainsFor(geography: Geography): string[] {
  const city = geography.city?.toLowerCase();
  const preferred = city ? cityDomains[city] : undefined;
  return [...new Set(preferred ? [preferred, ...officialDomains, ...trustedProgramDomains] : [...officialDomains, ...trustedProgramDomains])];
}

export function searchDomainsFor(geography: Geography): string[] {
  return [...new Set([...allowedDomainsFor(geography), ...trustedDiscoveryDomains])];
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

type RawCandidate = Omit<DiscoveredProgram, "id" | "lastChecked" | "status">;

export function validateDiscoveredPrograms(
  candidates: RawCandidate[],
  domains: readonly string[],
  citations: readonly string[],
  checkedAt: string,
): DiscoveredProgram[] {
  const cited = new Set(citations.filter((url) => isAllowedOfficialUrl(url, domains)).map(cleanUrl));
  const seen = new Set<string>();

  const validated = candidates.flatMap((candidate) => {
    if (!candidate?.name || !candidate.sourceUrl || !candidate.summary || !candidate.eligibilityText) return [];
    if (candidate.matchType !== "direct" && candidate.matchType !== "related") return [];
    if (!isAllowedOfficialUrl(candidate.sourceUrl, domains)) return [];
    const sourceUrl = cleanUrl(candidate.sourceUrl);
    const isCited = cited.has(sourceUrl) || [...cited].some((citation) => {
      try { return new URL(citation).hostname === new URL(sourceUrl).hostname; } catch { return false; }
    });
    if (!isCited) return [];
    const nameKey = slug(candidate.name);
    if (!nameKey || seen.has(nameKey)) return [];
    seen.add(nameKey);

    const applyUrl = isAllowedOfficialUrl(candidate.applyUrl, domains) ? cleanUrl(candidate.applyUrl) : sourceUrl;
    return [{
      ...candidate,
      id: `discovered-${nameKey}`,
      applyUrl,
      sourceUrl,
      lastChecked: checkedAt,
      status: "live" as const,
    }];
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);

  const direct = validated.filter((program) => program.matchType === "direct").slice(0, 5);
  const related = validated.filter((program) => program.matchType === "related").slice(0, 3);
  return [...direct, ...related];
}
