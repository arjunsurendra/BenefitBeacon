import assert from "node:assert/strict";
import test from "node:test";
import { programs } from "../data/programs";
import {
  geographyCacheKey,
  geographyFromCensus,
  isAllowedOfficialUrl,
  localGeography,
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
  assert.deepEqual(localGeography("94087"), { label: "ZIP 94087", zip: "94087", state: "California", stateCode: "CA" });
  assert.equal(localGeography("Sunnyvale, CA")?.county, "Santa Clara County");
  assert.equal(localGeography("123 Main St, Sunnyvale, CA"), null);
});

test("official URL validation rejects lookalike and insecure hosts", () => {
  const domains = ["ca.gov"];
  assert.equal(isAllowedOfficialUrl("https://www.ca.gov/service/", domains), true);
  assert.equal(isAllowedOfficialUrl("https://ca.gov.evil.example/service/", domains), false);
  assert.equal(isAllowedOfficialUrl("http://ca.gov/service/", domains), false);
});

test("candidate validation requires cited official sources and removes curated duplicates", () => {
  const raw = {
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
    programs,
    "2026-10-07T00:00:00.000Z",
  );
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].status, "unverified");
  assert.doesNotMatch(discovered[0].applyUrl, /utm_/);
});
