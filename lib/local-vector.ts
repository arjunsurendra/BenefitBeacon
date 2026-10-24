import type { Geography, UserProfile } from "@/lib/types";

export const LOCAL_VECTOR_DIMENSIONS = 128;

const expansions: Record<string, string[]> = {
  bill: ["utility", "payment", "discount"],
  bills: ["utility", "payment", "discount"],
  caregiver: ["care", "respite", "ihss"],
  childcare: ["children", "family", "youth"],
  credit: ["tax", "refund", "benefit"],
  disabled: ["disability", "accessibility", "medical"],
  disability: ["disabled", "accessibility", "medical"],
  electricity: ["energy", "utility", "bill"],
  energy: ["electricity", "utility", "weatherization"],
  food: ["nutrition", "meals", "calfresh", "wic"],
  health: ["medical", "insurance", "medicare", "medi-cal"],
  homeless: ["housing", "shelter", "unhoused"],
  housing: ["rent", "home", "shelter", "mortgage"],
  jobs: ["employment", "unemployment", "work"],
  repair: ["rehabilitation", "improvement", "home"],
  senior: ["older", "retired", "aging"],
  tax: ["credit", "refund", "income"],
  transportation: ["transit", "ride", "fare", "bus"],
  utilities: ["energy", "water", "electricity", "bill"],
  veterans: ["veteran", "military", "va"],
  water: ["utility", "landscape", "conservation", "rebate"],
};

function hash(value: string, seed: number): number {
  let result = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function tokenizeForVector(value: string): string[] {
  const base = value
    .toLowerCase()
    .replace(/medi[ -]?cal/g, "medical")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1);
  const expanded = base.flatMap((token) => [token, ...(expansions[token] ?? [])]);
  const bigrams = base.slice(1).map((token, index) => `${base[index]}_${token}`);
  return [...expanded, ...bigrams];
}

export function embedLocalText(value: string): number[] {
  const vector = Array.from({ length: LOCAL_VECTOR_DIMENSIONS }, () => 0);
  for (const token of tokenizeForVector(value)) {
    const index = hash(token, 2166136261) % LOCAL_VECTOR_DIMENSIONS;
    const sign = hash(token, 2246822519) % 2 === 0 ? 1 : -1;
    vector[index] += sign * (token.includes("_") ? 0.65 : 1);
  }
  const magnitude = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
  if (!magnitude) return vector;
  return vector.map((item) => Number((item / magnitude).toFixed(6)));
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function profileQueryText(profile: UserProfile, geography: Geography): string {
  const facts = [
    geography.city,
    geography.county,
    ...(profile.interests ?? []),
    profile.hasHighWaterBill ? "utility bills water energy assistance" : undefined,
    profile.housing === "own" ? "homeowner home repair rebates" : undefined,
    profile.housing === "rent" ? "renter rent housing assistance" : undefined,
    profile.housing === "unhoused" ? "unhoused shelter housing" : undefined,
    profile.veteran || profile.activeDuty ? "veteran military benefits" : undefined,
    profile.disabled ? "disability accessibility assistance" : undefined,
    profile.caregiver ? "caregiver respite in-home support" : undefined,
    profile.childrenAges?.length ? "children youth family childcare" : undefined,
    profile.ageRange === "65plus" ? "senior older adult retirement" : undefined,
    profile.employment === "unemployed" ? "unemployment jobs cash assistance" : undefined,
    profile.employment === "retired" ? "senior retirement fixed income" : undefined,
    profile.incomeBand && profile.incomeBand !== "over120k" ? "income qualified low income discount" : undefined,
  ].filter(Boolean);
  return facts.join(" ");
}
