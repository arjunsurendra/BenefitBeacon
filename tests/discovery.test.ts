import assert from "node:assert/strict";
import test from "node:test";
import {
  discoveryResearchCacheKey,
  discoveryProfileSignals,
  discoveryTopics,
  geographyCacheKey,
  geographyFromCensus,
  isAllowedOfficialUrl,
  localGeography,
  searchDomainsFor,
  validateDiscoveredPrograms,
} from "../lib/discovery";

test("location normalization creates a geography-only cache key", () => {
  const geography = geographyFromCensus({
    result: {
      addressMatches: [{
        addressComponents: { city: "SUNNYVALE", state: "CA", zip: "94087" },
        geographies: {
          Counties: [{ BASENAME: "Santa Clara" }],
          States: [{ BASENAME: "California" }],
          "119th Congressional Districts": [{ CD119: "17" }],
        },
      }],
    },
  });
  assert.ok(geography);
  assert.equal(geography.label, "Sunnyvale, Santa Clara County, CA, 94087");
  assert.equal(geographyCacheKey(geography), "sunnyvale|santa-clara-county|ca|94087");
  assert.doesNotMatch(JSON.stringify(geography), /123 main/i);
});

test("city and ZIP inputs resolve without exposing a street address", () => {
  assert.deepEqual(localGeography("94087"), { label: "Sunnyvale, Santa Clara County, CA, 94087", city: "Sunnyvale", county: "Santa Clara County", zip: "94087", state: "California", stateCode: "CA" });
  assert.equal(localGeography("95014")?.city, "Cupertino");
  assert.equal(localGeography("90210")?.city, undefined);
  assert.equal(localGeography("Sunnyvale, CA")?.county, "Santa Clara County");
  assert.equal(localGeography("123 Main St, Sunnyvale, CA"), null);
});

test("live research cache varies by stated need without retaining raw intake text", () => {
  const geography = localGeography("Sunnyvale, CA");
  assert.ok(geography);
  assert.deepEqual(discoveryTopics({ interests: ["Water rebates!"], hasHighWaterBill: true }), ["water rebates", "water and utility bill assistance"]);
  assert.deepEqual(discoveryProfileSignals({ housing: "own", caregiver: true }), ["homeowner", "unpaid caregiver"]);
  assert.equal(discoveryResearchCacheKey(geography, { interests: ["water rebates"] }), "sunnyvale|santa-clara-county|ca|live-v4|needs:water-rebates|profile:none");
  assert.notEqual(discoveryResearchCacheKey(geography, { interests: ["water rebates"] }), discoveryResearchCacheKey(geography, { interests: ["food"] }));
});

test("official URL validation rejects lookalike and insecure hosts", () => {
  const domains = ["ca.gov"];
  assert.equal(isAllowedOfficialUrl("https://www.ca.gov/service/", domains), true);
  assert.equal(isAllowedOfficialUrl("https://ca.gov.evil.example/service/", domains), false);
  assert.equal(isAllowedOfficialUrl("http://ca.gov/service/", domains), false);
});

test("search uses authoritative program sources plus trusted discovery directories", () => {
  const geography = localGeography("Sunnyvale, CA");
  assert.ok(geography);
  const domains = searchDomainsFor(geography);
  assert.ok(domains.includes("sunnyvale.ca.gov"));
  assert.ok(domains.includes("pge.com"));
  assert.ok(domains.includes("211bayarea.org"));
  assert.ok(domains.includes("findhelp.org"));
});

test("candidate validation requires cited sources and removes duplicate findings", () => {
  const raw = {
    matchType: "direct" as const,
    name: "County transit fare assistance",
    level: "county" as const,
    jurisdiction: "Santa Clara County",
    category: "transportation" as const,
    summary: "Reduced transit fares for qualifying county residents.",
    benefit: "Reduced transit fare",
    eligibilityText: "The agency lists income and residency requirements.",
    applyUrl: "https://www.santaclaracounty.gov/transit/apply?utm_source=test",
    sourceUrl: "https://www.santaclaracounty.gov/transit",
    sourceLabel: "County of Santa Clara",
    sourceSnippet: "The official page describes reduced-fare transit assistance.",
    relevanceReason: "The resident asked about transportation support.",
    relevanceScore: 82,
  };
  const discovered = validateDiscoveredPrograms(
    [raw, { ...raw }, { ...raw, name: "Uncited program", sourceUrl: "https://www.ca.gov/uncited" }],
    ["santaclaracounty.gov", "ca.gov"],
    ["https://www.santaclaracounty.gov/transit?utm_source=chatgpt.com"],
    "2026-10-07T00:00:00.000Z",
  );
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].status, "live");
  assert.equal(discovered[0].lastChecked, "2026-10-07T00:00:00.000Z");
  assert.doesNotMatch(discovered[0].applyUrl, /utm_/);
});

test("candidate validation limits direct matches and related discoveries separately", () => {
  const candidate = {
    matchType: "direct" as const,
    name: "Program 0",
    level: "county" as const,
    jurisdiction: "Santa Clara County",
    category: "transportation" as const,
    summary: "A current program with a concrete local transportation benefit.",
    benefit: "Transportation assistance",
    eligibilityText: "Review the program page for current eligibility requirements.",
    applyUrl: "https://www.santaclaracounty.gov/program-0",
    sourceUrl: "https://www.santaclaracounty.gov/program-0",
    sourceLabel: "County of Santa Clara",
    sourceSnippet: "The official source describes the transportation program and application process.",
    relevanceReason: "The resident asked for transportation support.",
    relevanceScore: 90,
  };
  const candidates = [
    ...Array.from({ length: 6 }, (_, index) => ({ ...candidate, name: `Direct ${index}`, sourceUrl: `https://www.santaclaracounty.gov/direct-${index}`, applyUrl: `https://www.santaclaracounty.gov/direct-${index}`, relevanceScore: 90 - index })),
    ...Array.from({ length: 4 }, (_, index) => ({ ...candidate, matchType: "related" as const, name: `Related ${index}`, sourceUrl: `https://www.santaclaracounty.gov/related-${index}`, applyUrl: `https://www.santaclaracounty.gov/related-${index}`, relevanceScore: 80 - index })),
  ];
  const discovered = validateDiscoveredPrograms(candidates, ["santaclaracounty.gov"], ["https://www.santaclaracounty.gov/benefits"], "2026-10-08T00:00:00.000Z");
  assert.equal(discovered.filter((program) => program.matchType === "direct").length, 5);
  assert.equal(discovered.filter((program) => program.matchType === "related").length, 3);
});
