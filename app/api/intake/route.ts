import { redactSensitiveText } from "@/lib/privacy/redact";
import type { UserProfile } from "@/lib/types";

export const runtime = "edge";

const requestWindow = new Map<string, { count: number; resetAt: number }>();
const windowMs = 60_000;
const maxRequests = 12;

const profileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    zip: { type: ["string", "null"] },
    city: { type: ["string", "null"] },
    state: { type: ["string", "null"] },
    ageRange: { type: ["string", "null"], enum: ["under18", "18-24", "25-54", "55-61", "62-64", "65plus", null] },
    householdSize: { type: ["integer", "null"], minimum: 1, maximum: 30 },
    childrenAges: { type: ["array", "null"], items: { type: "integer", minimum: 0, maximum: 25 }, maxItems: 12 },
    incomeBand: { type: ["string", "null"], enum: ["under25k", "25-50k", "50-80k", "80-120k", "over120k", null] },
    housing: { type: ["string", "null"], enum: ["own", "rent", "unhoused", "other", null] },
    veteran: { type: ["boolean", "null"] },
    activeDuty: { type: ["boolean", "null"] },
    disabled: { type: ["boolean", "null"] },
    caregiver: { type: ["boolean", "null"] },
    employment: { type: ["string", "null"], enum: ["employed", "unemployed", "retired", "student", "other", null] },
    homeAgeYears: { type: ["integer", "null"], minimum: 0, maximum: 250 },
    hasHighWaterBill: { type: ["boolean", "null"] },
    interests: { type: ["array", "null"], items: { type: "string" }, maxItems: 8 },
    language: { type: ["string", "null"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    followUpQuestions: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
  required: ["zip", "city", "state", "ageRange", "householdSize", "childrenAges", "incomeBand", "housing", "veteran", "activeDuty", "disabled", "caregiver", "employment", "homeAgeYears", "hasHighWaterBill", "interests", "language", "confidence", "followUpQuestions"],
} as const;

function getOutputText(payload: { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }): string | undefined {
  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("");
}

function stripNulls(value: Record<string, unknown>): UserProfile {
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => item !== null && key !== "confidence" && key !== "followUpQuestions")) as UserProfile;
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

export async function POST(request: Request) {
  if (rateLimited(requestId(request))) {
    return Response.json({ error: "Please wait a moment before trying again." }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AI mode is not configured. Guided matching is still available." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  if (!body || typeof body.text !== "string" || body.text.trim().length < 8 || body.text.length > 2_000) {
    return Response.json({ error: "Describe your situation in 8 to 2,000 characters." }, { status: 400 });
  }

  const { text, redacted } = redactSensitiveText(body.text.trim());
  const model = process.env.OPENAI_MODEL || "gpt-6-luna";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions: [
        "Extract only facts explicitly stated by the resident.",
        "Never infer race, citizenship, health conditions, disability, exact location, or other sensitive traits.",
        "Use null for unknown values. Normalize California to state CA and cities to lowercase.",
        "Use broad income and age ranges only. Do not decide benefit eligibility.",
        "Ask at most three short follow-up questions that would distinguish high-impact program matches.",
      ].join(" "),
      input: text,
      text: {
        format: {
          type: "json_schema",
          name: "benefitbeacon_intake",
          strict: true,
          schema: profileSchema,
        },
      },
      max_output_tokens: 900,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) return Response.json({ error: "The OpenAI API key was rejected. Replace OPENAI_API_KEY in .env.local, then restart the local server." }, { status: 503 });
    if (response.status === 429) return Response.json({ error: "The OpenAI project has reached a rate or usage limit. Guided matching is still available." }, { status: 429 });
    return Response.json({ error: "AI intake is temporarily unavailable. Guided matching is still available." }, { status: 502 });
  }

  const payload = (await response.json()) as { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  const outputText = getOutputText(payload);
  if (!outputText) return Response.json({ error: "The AI response could not be read." }, { status: 502 });

  const parsed = JSON.parse(outputText) as Record<string, unknown>;
  return Response.json({
    profile: stripNulls(parsed),
    confidence: parsed.confidence,
    followUpQuestions: parsed.followUpQuestions,
    mode: "openai",
    model,
    redacted,
  });
}
