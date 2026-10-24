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

export type IntakeResponse = {
  profile: UserProfile;
  confidence: number;
  followUpQuestions: string[];
  mode: "openai" | "local";
  model?: string;
  redacted: boolean;
};

export type Geography = {
  label: string;
  city?: string;
  county?: string;
  state?: string;
  stateCode?: string;
  zip?: string;
  congressionalDistrict?: string;
};

export type DiscoveredProgram = {
  id: string;
  matchType: "direct" | "related";
  name: string;
  level: "city" | "county" | "state" | "federal";
  jurisdiction: string;
  category: "food" | "health" | "utilities" | "home" | "veterans" | "family" | "transportation" | "other";
  summary: string;
  benefit: string;
  eligibilityText: string;
  applyUrl: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceSnippet: string;
  relevanceReason: string;
  relevanceScore: number;
  lastChecked: string;
  status: "indexed" | "live";
};

export type DiscoveryResponse = {
  geography: Geography;
  candidates: DiscoveredProgram[];
  mode: "browse" | "indexed" | "indexed-ai" | "live-fallback";
  model?: string;
  searchedAt: string;
  cacheKey: string;
  cached: boolean;
  addressDiscarded: boolean;
  indexedCount: number;
  fallbackAvailable: boolean;
};

export type ProgramChatCitation = {
  url: string;
  title: string;
  startIndex: number;
  endIndex: number;
};

export type ProgramChatMessage = {
  role: "user" | "assistant";
  text: string;
  needsMoreInfo?: boolean;
  citations?: ProgramChatCitation[];
  sources?: Array<{ url: string; title: string }>;
};

export type ProgramChatResponse = {
  answer: string;
  needsMoreInfo: boolean;
  citations: ProgramChatCitation[];
  sources: Array<{ url: string; title: string }>;
  model: string;
  searchedAt: string;
};
