const omittedDetailPatterns = [
  /\bunknown\b/i,
  /\b(?:is|are|was|were)\s+(?:not known|unavailable)\b/i,
  /\b(?:isn['’]?t|aren['’]?t|wasn['’]?t|weren['’]?t)\s+known\b/i,
  /\b(?:not|wasn['’]?t|weren['’]?t)\s+(?:provided|shared|stated|supplied)\b/i,
  /\bno\s+(?:information|details|facts)\s+(?:was|were)\s+(?:provided|shared|supplied)\b/i,
  /\b(?:you|the resident)\s+(?:did not|didn['’]?t|have not|haven['’]?t)\s+(?:provide|share|state|supply)\b/i,
  /\b(?:i|we)\s+(?:do not|don['’]?t)\s+know\b/i,
  /\b(?:i|we)\s+(?:lack|do not have|don['’]?t have)\s+(?:information|details|facts)\b/i,
  /\b(?:cannot|can['’]?t|unable to)\s+(?:determine|assess|confirm|tell)\b/i,
  /\b(?:missing|insufficient)\s+(?:information|details|facts)\b/i,
  /\bthose details\b/i,
];

function shouldOmit(sentence: string): boolean {
  return omittedDetailPatterns.some((pattern) => pattern.test(sentence));
}

export function omitUnknownStatements(value: string): { text: string; changed: boolean } {
  let changed = false;
  const lines = value.split("\n").flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) return [""];
    const prefix = trimmed.match(/^(?:#{1,6}\s+|[-*]\s+|\d+\.\s+)/)?.[0] ?? "";
    const body = trimmed.slice(prefix.length);
    const sentences = body.split(/(?<=[.!?])(?=\s+|$)/).map((sentence) => sentence.trim()).filter(Boolean);
    const kept: string[] = [];
    let removedPrevious = false;
    for (const sentence of sentences) {
      if (shouldOmit(sentence)) {
        changed = true;
        removedPrevious = true;
        continue;
      }
      if (removedPrevious && /^\(?\[[^\]]+\]\(https:\/\/[^)]+\)\)?[.!]?$/.test(sentence)) {
        changed = true;
        continue;
      }
      removedPrevious = false;
      kept.push(sentence);
    }
    if (!kept.length) return [];
    return [`${prefix}${kept.join(" ").trim()}`];
  });
  return { text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), changed };
}
