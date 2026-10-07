export type AgeRange =
  | "under18"
  | "18-24"
  | "25-54"
  | "55-61"
  | "62-64"
  | "65plus";

export type IncomeBand =
  | "under25k"
  | "25-50k"
  | "50-80k"
  | "80-120k"
  | "over120k";

export type UserProfile = {
  zip?: string;
  city?: string;
  state?: string;
  ageRange?: AgeRange;
  householdSize?: number;
  childrenAges?: number[];
  incomeBand?: IncomeBand;
  housing?: "own" | "rent" | "unhoused" | "other";
  veteran?: boolean;
  activeDuty?: boolean;
  disabled?: boolean;
  caregiver?: boolean;
  employment?: "employed" | "unemployed" | "retired" | "student" | "other";
  homeAgeYears?: number;
  hasHighWaterBill?: boolean;
  interests?: string[];
  language?: string;
};

export type RuleOperator = "eq" | "in" | "gte" | "lte" | "in_list" | "between";

export type EligibilityRule = {
  field: keyof UserProfile;
  op: RuleOperator;
  value: unknown;
  label: string;
};

export type Program = {
  id: string;
  name: string;
  level: "city" | "county" | "state" | "federal";
  jurisdiction: string;
  category: "food" | "health" | "utilities" | "home" | "veterans" | "family";
  summary: string;
  benefit: string;
  eligibility: {
    all?: EligibilityRule[];
    any?: EligibilityRule[];
    not?: EligibilityRule[];
  };
  applyUrl: string;
  steps: string[];
  sourceUrl: string;
  sourceLabel: string;
  sourceSnippet: string;
  lastVerified: string;
  impactScore: number;
};

export type EligibilityStatus = "likely" | "maybe" | "unlikely";

export type EligibilityResult = {
  program: Program;
  status: EligibilityStatus;
  score: number;
  matchedRules: string[];
  failedRules: string[];
  missingInfo: string[];
};

export type IntakeResponse = {
  profile: UserProfile;
  confidence: number;
  followUpQuestions: string[];
  mode: "openai" | "local";
  model?: string;
  redacted: boolean;
};
