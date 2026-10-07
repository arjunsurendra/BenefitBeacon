const patterns = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN REMOVED]" },
  { pattern: /\b(?:\d[ -]*?){13,16}\b/g, replacement: "[ACCOUNT NUMBER REMOVED]" },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[EMAIL REMOVED]" },
  { pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE REMOVED]" },
  { pattern: /\b\d{1,5}\s+[A-Za-z0-9.' -]+\s(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Boulevard|Blvd)\b\.?/gi, replacement: "[ADDRESS REMOVED]" },
];

export function redactSensitiveText(input: string): { text: string; redacted: boolean } {
  let text = input;
  for (const { pattern, replacement } of patterns) text = text.replace(pattern, replacement);
  return { text, redacted: text !== input };
}
