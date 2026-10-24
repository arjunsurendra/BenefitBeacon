import assert from "node:assert/strict";
import test from "node:test";
import { omitUnknownStatements } from "../lib/response-policy";

test("removes statements that inventory unknown resident details", () => {
  const result = omitUnknownStatements("The program provides a monthly discount. Your homeownership and income are unknown. Apply through the official program page.");
  assert.equal(result.text, "The program provides a monthly discount. Apply through the official program page.");
  assert.equal(result.changed, true);
});

test("removes equivalent missing-detail language while preserving direct questions", () => {
  const result = omitUnknownStatements("Those details were not provided. What is your approximate household income range?");
  assert.equal(result.text, "What is your approximate household income range?");
  assert.equal(result.changed, true);
});

test("removes not-known wording and its orphaned citation", () => {
  const result = omitUnknownStatements("The grant covers accessibility repairs. Your income isn't known. ([Official source](https://example.gov/program))");
  assert.equal(result.text, "The grant covers accessibility repairs.");
  assert.equal(result.changed, true);
});

test("preserves sourced factual answers", () => {
  const text = "Sunnyvale residents may apply online. The published income limit is $50,000.";
  assert.deepEqual(omitUnknownStatements(text), { text, changed: false });
});
