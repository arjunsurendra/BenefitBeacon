import type { UserProfile } from "@/lib/types";
import { extensionPreflight, withExtensionCors } from "@/lib/extension-cors";

export const runtime = "edge";

const requestWindow = new Map<string, { count: number; resetAt: number }>();
const windowMs = 60_000;
const maxRequests = 10;

type SafeField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  autocomplete: string;
  options: Array<{ value: string; text: string }>;
};

type Suggestion = {
  fieldId: string;
  value: string;
  confidence: number;
  reason: string;
};

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      maxItems: 60,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fieldId: { type: "string" },
          value: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string" },
        },
        required: ["fieldId", "value", "confidence", "reason"],
      },
    },
  },
  required: ["suggestions"],
} as const;

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

function safeProfile(value: unknown): UserProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const allowed = new Set(["city", "state", "zip", "ageRange", "householdSize", "childrenAges", "incomeBand", "housing", "veteran", "activeDuty", "disabled", "caregiver", "employment", "homeAgeYears", "hasHighWaterBill", "interests", "language"]);
  return Object.fromEntries(Object.entries(input).filter(([key, item]) => allowed.has(key) && (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || Array.isArray(item)))) as UserProfile;
}

function safeFields(value: unknown): SafeField[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 120).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const input = item as Record<string, unknown>;
    const id = typeof input.id === "string" ? input.id.trim().slice(0, 80) : "";
    const label = typeof input.label === "string" ? input.label.trim().slice(0, 300) : "";
    if (!id || !label || input.sensitive === true || input.hasValue === true) return [];
    const options = Array.isArray(input.options) ? input.options.slice(0, 60).flatMap((option) => {
      if (!option || typeof option !== "object" || Array.isArray(option)) return [];
      const candidate = option as Record<string, unknown>;
      const optionValue = typeof candidate.value === "string" ? candidate.value.slice(0, 160) : "";
      const text = typeof candidate.text === "string" ? candidate.text.slice(0, 160) : "";
      return optionValue || text ? [{ value: optionValue, text }] : [];
    }) : [];
    return [{
      id,
      label,
      type: typeof input.type === "string" ? input.type.slice(0, 40) : "text",
      required: input.required === true,
      autocomplete: typeof input.autocomplete === "string" ? input.autocomplete.slice(0, 80) : "",
      options,
    }];
  });
}

function outputText(payload: { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }): string {
  return payload.output?.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("").trim() ?? "";
}

function validSuggestions(value: unknown, fields: SafeField[]): Suggestion[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(raw)) return [];
  const byId = new Map(fields.map((field) => [field.id, field]));
  const seen = new Set<string>();
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const input = item as Record<string, unknown>;
    const fieldId = typeof input.fieldId === "string" ? input.fieldId : "";
    const field = byId.get(fieldId);
    const value = typeof input.value === "string" ? input.value.trim().slice(0, 300) : "";
    const confidence = typeof input.confidence === "number" ? input.confidence : 0;
    const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 240) : "Matched to information you shared.";
    if (!field || !value || confidence < 0.82 || seen.has(fieldId)) return [];
    if (field.options.length && !field.options.some((option) => option.value === value || option.text === value)) return [];
    seen.add(fieldId);
    return [{ fieldId, value, confidence, reason }];
  });
}

async function handlePost(request: Request) {
  if (rateLimited(requestId(request))) return Response.json({ error: "Please wait a moment before preparing autofill again." }, { status: 429 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "AI autofill is temporarily unavailable." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { fields?: unknown; profile?: unknown; page?: unknown; program?: unknown } | null;
  const fields = safeFields(body?.fields);
  const profile = safeProfile(body?.profile);
  if (!fields.length) return Response.json({ suggestions: [], model: null });

  const page = body?.page && typeof body.page === "object" && !Array.isArray(body.page) ? body.page as Record<string, unknown> : {};
  const program = body?.program && typeof body.program === "object" && !Array.isArray(body.program) ? body.program as Record<string, unknown> : {};
  const model = process.env.OPENAI_FORM_MODEL || process.env.OPENAI_MODEL || "gpt-6-luna";

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "low" },
        instructions: [
          "You map facts a resident explicitly shared to fields in a public-benefit application.",
          "This is clerical assistance only. Do not decide eligibility, rank the resident, or infer any fact.",
          "Suggest a value only when the resident profile directly and unambiguously answers that exact field.",
          "Never convert an age range to an exact age or birth date, an income band to an exact income, home age to an exact construction year, ownership to primary residence, or an interest into a certification.",
          "Never fill names, street addresses, email, phone, Social Security or tax identifiers, account or routing numbers, driver license or document numbers, full birth dates, race, ethnicity, sex, gender, religion, national origin, marital status, signatures, attestations, agreement checkboxes, file uploads, or legal certifications.",
          "Never overwrite a field. All supplied fields are currently empty and marked non-sensitive by a second safety layer.",
          "For select fields, return exactly one supplied option value or option text. For checkbox or radio fields, return true only if the exact proposition is directly supported; otherwise omit it.",
          "Omit uncertain mappings. Use confidence of at least 0.82 only for direct matches. Explain the resident-supplied fact briefly without exposing sensitive information.",
        ].join(" "),
        input: JSON.stringify({
          application: {
            title: typeof page.title === "string" ? page.title.slice(0, 180) : "Application",
            host: typeof page.host === "string" ? page.host.slice(0, 180) : "",
            selectedProgram: {
              name: typeof program.name === "string" ? program.name.slice(0, 180) : "",
              category: typeof program.category === "string" ? program.category.slice(0, 80) : "",
            },
          },
          residentProfile: profile,
          emptyFields: fields,
        }),
        text: { format: { type: "json_schema", name: "benefitbeacon_form_autofill", strict: true, schema: outputSchema } },
        max_output_tokens: 2_200,
      }),
    });
    if (!response.ok) return Response.json({ error: "AI autofill could not prepare suggestions right now." }, { status: response.status === 429 ? 429 : 502 });
    const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = outputText(payload);
    if (!text) return Response.json({ error: "AI autofill did not return suggestions." }, { status: 502 });
    const suggestions = validSuggestions(JSON.parse(text), fields);
    return Response.json({ suggestions, model, preparedAt: new Date().toISOString() });
  } catch {
    return Response.json({ error: "AI autofill is temporarily unavailable." }, { status: 502 });
  }
}

export function OPTIONS(request: Request) {
  return extensionPreflight(request);
}

export async function POST(request: Request) {
  return withExtensionCors(request, await handlePost(request));
}
