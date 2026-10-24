import { getProgramDb } from "@/db";
import { cosineSimilarity, embedLocalText, profileQueryText, tokenizeForVector } from "@/lib/local-vector";
import type { DiscoveredProgram, Geography, UserProfile } from "@/lib/types";

type ProgramRow = {
  id: string;
  name: string;
  level: DiscoveredProgram["level"];
  jurisdiction: string;
  city_scope: string;
  category: DiscoveredProgram["category"];
  summary: string;
  benefit: string;
  eligibility_text: string;
  apply_url: string;
  source_url: string;
  source_label: string;
  source_snippet: string;
  interest_tags: string;
  audience_tags: string;
  housing_scope: string;
  min_age: number | null;
  max_age: number | null;
  income_targeted: number;
  requires_children: number;
  requires_disability: number;
  requires_veteran: number;
  requires_caregiver: number;
  embedding_json: string;
  last_checked: string;
};

export type IndexedCandidate = DiscoveredProgram & {
  retrievalScore: number;
};

async function rowsForCity(geography: Geography): Promise<ProgramRow[]> {
  const city = geography.city?.toLowerCase();
  if (!city || !["sunnyvale", "cupertino"].includes(city)) return [];
  const result = await getProgramDb()
    .prepare("SELECT * FROM programs WHERE active = 1 AND instr(',' || city_scope || ',', ',' || ? || ',') > 0 ORDER BY CASE level WHEN 'city' THEN 1 WHEN 'county' THEN 2 WHEN 'state' THEN 3 ELSE 4 END, name")
    .bind(city)
    .all<ProgramRow>();
  return result.results ?? [];
}

function browseProgram(row: ProgramRow, geography: Geography): DiscoveredProgram {
  return {
    id: row.id,
    matchType: "direct",
    name: row.name,
    level: row.level,
    jurisdiction: row.jurisdiction,
    category: row.category,
    summary: row.summary,
    benefit: row.benefit,
    eligibilityText: row.eligibility_text,
    applyUrl: row.apply_url,
    sourceUrl: row.source_url,
    sourceLabel: row.source_label,
    sourceSnippet: row.source_snippet,
    relevanceReason: `Available to residents exploring programs in ${geography.city ?? geography.label}.`,
    relevanceScore: 0,
    lastChecked: row.last_checked,
    status: "indexed",
  };
}

const ageForRange: Record<NonNullable<UserProfile["ageRange"]>, number> = {
  under18: 17,
  "18-24": 21,
  "25-54": 40,
  "55-61": 58,
  "62-64": 63,
  "65plus": 70,
};

function tags(value: string): string[] {
  return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function explicitNeedTokens(profile: UserProfile): Set<string> {
  const text = [
    ...(profile.interests ?? []),
    profile.hasHighWaterBill ? "water utility bills energy" : "",
  ].join(" ");
  return new Set(tokenizeForVector(text).filter((token) => !token.includes("_")));
}

function hasKnownMismatch(row: ProgramRow, profile: UserProfile): boolean {
  const age = profile.ageRange ? ageForRange[profile.ageRange] : undefined;
  if (row.requires_children) {
    if (profile.childrenAges && profile.childrenAges.length === 0) return true;
    if (profile.childrenAges?.length && (row.min_age !== null || row.max_age !== null)) {
      const hasChildInRange = profile.childrenAges.some((childAge) =>
        (row.min_age === null || childAge >= row.min_age) && (row.max_age === null || childAge <= row.max_age));
      if (!hasChildInRange) return true;
    }
  } else {
    if (age !== undefined && row.min_age !== null && age < row.min_age) return true;
    if (age !== undefined && row.max_age !== null && age > row.max_age) return true;
  }
  if (row.housing_scope === "owner" && profile.housing && profile.housing !== "own") return true;
  if (row.housing_scope === "renter" && profile.housing && profile.housing !== "rent") return true;
  if (row.requires_disability && profile.disabled === false) return true;
  if (row.requires_veteran && profile.veteran === false && profile.activeDuty === false) return true;
  if (row.requires_caregiver && profile.caregiver === false) return true;
  return false;
}

function profileMatchesAudience(row: ProgramRow, profile: UserProfile): string[] {
  const audience = new Set(tags(row.audience_tags));
  const matches: string[] = [];
  if (profile.housing === "own" && audience.has("homeowner")) matches.push("homeowner status");
  if (profile.housing === "rent" && audience.has("renter")) matches.push("renter status");
  if (profile.housing === "unhoused" && audience.has("unhoused")) matches.push("housing situation");
  if ((profile.veteran || profile.activeDuty) && (audience.has("veteran") || audience.has("active duty"))) matches.push("military connection");
  if (profile.disabled && audience.has("disability")) matches.push("disability support need");
  if (profile.caregiver && audience.has("caregiver")) matches.push("caregiver role");
  if (profile.childrenAges?.length && (audience.has("children") || audience.has("family"))) matches.push("household with children");
  if (profile.ageRange === "65plus" && audience.has("senior")) matches.push("older-adult age range");
  if (profile.employment === "unemployed" && audience.has("unemployed")) matches.push("employment situation");
  if (profile.incomeBand && profile.incomeBand !== "over120k" && audience.has("low income")) matches.push("income range");
  return matches;
}

function defaultReason(row: ProgramRow, needMatches: string[], audienceMatches: string[], city: string): string {
  if (needMatches.length) return `Matches your stated interest in ${needMatches.slice(0, 2).join(" and ")} and serves ${city}.`;
  if (audienceMatches.length) return `Your ${audienceMatches[0]} makes this ${row.level} program worth checking.`;
  return `This ${row.level} program serves residents of ${city}.`;
}

function scoreRow(row: ProgramRow, profile: UserProfile, geography: Geography, queryVector: number[], needs: Set<string>): IndexedCandidate | null {
  if (hasKnownMismatch(row, profile)) return null;
  let embedding: number[];
  try { embedding = JSON.parse(row.embedding_json) as number[]; } catch { return null; }
  const programTags = tags(row.interest_tags);
  const needMatches = programTags.filter((tag) => tokenizeForVector(tag).some((token) => needs.has(token)));
  const audienceMatches = profileMatchesAudience(row, profile);
  const similarity = Math.max(0, cosineSimilarity(queryVector, embedding));
  const cityBoost = row.level === "city" ? 8 : row.level === "county" ? 5 : 2;
  const needBoost = Math.min(28, needMatches.length * 11);
  const audienceBoost = Math.min(20, audienceMatches.length * 7);
  const incomeBoost = row.income_targeted && profile.incomeBand && profile.incomeBand !== "over120k" ? 5 : 0;
  const score = Math.max(1, Math.min(100, Math.round(similarity * 47 + cityBoost + needBoost + audienceBoost + incomeBoost)));
  const direct = needs.size > 0 ? needMatches.length > 0 : audienceMatches.length > 0;
  return {
    id: row.id,
    matchType: direct ? "direct" : "related",
    name: row.name,
    level: row.level,
    jurisdiction: row.jurisdiction,
    category: row.category,
    summary: row.summary,
    benefit: row.benefit,
    eligibilityText: row.eligibility_text,
    applyUrl: row.apply_url,
    sourceUrl: row.source_url,
    sourceLabel: row.source_label,
    sourceSnippet: row.source_snippet,
    relevanceReason: defaultReason(row, needMatches, audienceMatches, geography.city ?? geography.label),
    relevanceScore: score,
    retrievalScore: score,
    lastChecked: row.last_checked,
    status: "indexed",
  };
}

export async function retrieveIndexedPrograms(geography: Geography, profile: UserProfile): Promise<{ candidates: IndexedCandidate[]; indexedCount: number }> {
  const rows = await rowsForCity(geography);
  const queryVector = embedLocalText(profileQueryText(profile, geography));
  const needs = explicitNeedTokens(profile);
  const scored = rows
    .map((row) => scoreRow(row, profile, geography, queryVector, needs))
    .filter((candidate): candidate is IndexedCandidate => Boolean(candidate))
    .sort((left, right) => right.retrievalScore - left.retrievalScore);
  const direct = scored.filter((candidate) => candidate.matchType === "direct").slice(0, 10);
  const related = scored.filter((candidate) => candidate.matchType === "related" && candidate.retrievalScore >= 8).slice(0, 6);
  return { candidates: [...direct, ...related], indexedCount: rows.length };
}

export async function listIndexedPrograms(geography: Geography): Promise<DiscoveredProgram[]> {
  return (await rowsForCity(geography)).map((row) => browseProgram(row, geography));
}

export async function getIndexedProgramById(id: string): Promise<DiscoveredProgram | null> {
  if (!/^[a-z0-9-]{3,100}$/.test(id)) return null;
  const row = await getProgramDb().prepare("SELECT * FROM programs WHERE id = ? AND active = 1 LIMIT 1").bind(id).first<ProgramRow>();
  if (!row) return null;
  const city = row.city_scope.split(",")[0]?.trim();
  return browseProgram(row, { label: row.jurisdiction, city: city ? city.replace(/\b\w/g, (letter) => letter.toUpperCase()) : undefined });
}

export function capRankedPrograms(candidates: DiscoveredProgram[]): DiscoveredProgram[] {
  const direct = candidates.filter((candidate) => candidate.matchType === "direct").slice(0, 5);
  const related = candidates.filter((candidate) => candidate.matchType === "related").slice(0, 3);
  return [...direct, ...related];
}
