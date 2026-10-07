import type { EligibilityResult, EligibilityRule, Program, UserProfile } from "@/lib/types";

type RuleState = "pass" | "fail" | "unknown";

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function evaluateOperator(actual: unknown, rule: EligibilityRule): RuleState {
  if (isMissing(actual)) return "unknown";

  const expected = rule.value;
  switch (rule.op) {
    case "eq":
      return String(actual).toLowerCase() === String(expected).toLowerCase() ? "pass" : "fail";
    case "in": {
      const allowed = Array.isArray(expected) ? expected.map((item) => String(item).toLowerCase()) : [];
      if (Array.isArray(actual)) {
        return actual.some((item) => allowed.includes(String(item).toLowerCase())) ? "pass" : "fail";
      }
      return allowed.includes(String(actual).toLowerCase()) ? "pass" : "fail";
    }
    case "in_list":
      return Array.isArray(expected) && expected.includes(actual) ? "pass" : "fail";
    case "gte":
      if (Array.isArray(actual)) return actual.length >= Number(expected) ? "pass" : "fail";
      return Number(actual) >= Number(expected) ? "pass" : "fail";
    case "lte":
      if (Array.isArray(actual)) return actual.some((item) => Number(item) <= Number(expected)) ? "pass" : "fail";
      return Number(actual) <= Number(expected) ? "pass" : "fail";
    case "between": {
      const [min, max] = Array.isArray(expected) ? expected.map(Number) : [Number.NaN, Number.NaN];
      if (Array.isArray(actual)) return actual.some((item) => Number(item) >= min && Number(item) <= max) ? "pass" : "fail";
      return Number(actual) >= min && Number(actual) <= max ? "pass" : "fail";
    }
  }
}

function evaluateRules(profile: UserProfile, rules: EligibilityRule[] = []) {
  return rules.map((rule) => ({ rule, state: evaluateOperator(profile[rule.field], rule) }));
}

export function evaluateProgram(profile: UserProfile, program: Program): EligibilityResult {
  const all = evaluateRules(profile, program.eligibility.all);
  const any = evaluateRules(profile, program.eligibility.any);
  const not = evaluateRules(profile, program.eligibility.not);

  const allFailed = all.some(({ state }) => state === "fail");
  const anyFailed = any.length > 0 && any.every(({ state }) => state === "fail");
  const anyPassed = any.some(({ state }) => state === "pass");
  const notFailed = not.some(({ state }) => state === "pass");
  const missing = [
    ...all.filter(({ state }) => state === "unknown"),
    ...(anyPassed ? [] : any.filter(({ state }) => state === "unknown")),
    ...not.filter(({ state }) => state === "unknown"),
  ].map(({ rule }) => String(rule.field));
  const passed = [...all, ...any].filter(({ state }) => state === "pass");
  const failed = [...all, ...any].filter(({ state }) => state === "fail");

  const status = allFailed || anyFailed || notFailed ? "unlikely" : missing.length ? "maybe" : "likely";
  const coverage = passed.length / Math.max(1, all.length + (any.length ? 1 : 0));
  const score = Math.round(program.impactScore * (status === "likely" ? 1 : status === "maybe" ? 0.7 : 0.28) + coverage * 10);

  return {
    program,
    status,
    score,
    matchedRules: passed.map(({ rule }) => rule.label),
    failedRules: failed.map(({ rule }) => rule.label),
    missingInfo: [...new Set(missing)],
  };
}

export function rankPrograms(profile: UserProfile, programs: Program[]): EligibilityResult[] {
  return programs.map((program) => evaluateProgram(profile, program)).sort((a, b) => b.score - a.score);
}

export function topFollowUpQuestions(results: EligibilityResult[]): string[] {
  const fieldCounts = new Map<string, number>();
  results
    .filter((result) => result.status === "maybe")
    .slice(0, 6)
    .forEach((result) => result.missingInfo.forEach((field) => fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1)));

  const questions: Record<string, string> = {
    city: "Which city do you live in?",
    state: "Do you live in California?",
    incomeBand: "Which broad income range fits your household?",
    householdSize: "How many people are in your household?",
    childrenAges: "Do you care for children, and what are their age ranges?",
    housing: "Do you own or rent your home?",
    veteran: "Are you a Veteran or part of a Veteran family?",
    activeDuty: "Are you currently serving on active duty?",
    hasHighWaterBill: "Are high water or energy bills a concern?",
    interests: "What kind of help are you looking for?",
  };

  return [...fieldCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([field]) => questions[field])
    .filter(Boolean);
}
