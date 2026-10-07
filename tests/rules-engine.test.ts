import assert from "node:assert/strict";
import test from "node:test";
import { programs } from "../data/programs";
import { evaluateOperator, rankPrograms } from "../lib/rules/engine";
import type { EligibilityRule } from "../lib/types";

function rule(op: EligibilityRule["op"], value: unknown): EligibilityRule {
  return { field: "householdSize", op, value, label: "test" };
}

test("rules engine supports every operator", () => {
  assert.equal(evaluateOperator(2, rule("eq", 2)), "pass");
  assert.equal(evaluateOperator("rent", rule("in", ["rent", "own"])), "pass");
  assert.equal(evaluateOperator(4, rule("gte", 3)), "pass");
  assert.equal(evaluateOperator(4, rule("lte", 4)), "pass");
  assert.equal(evaluateOperator("94087", rule("in_list", ["94087"])), "pass");
  assert.equal(evaluateOperator(68, rule("between", [65, 75])), "pass");
  assert.equal(evaluateOperator(undefined, rule("eq", true)), "unknown");
});

test("rules, not the model, determine ranked eligibility", () => {
  const results = rankPrograms({ city: "sunnyvale", state: "CA", ageRange: "65plus", incomeBand: "25-50k", housing: "rent", veteran: true, childrenAges: [4, 9], hasHighWaterBill: true }, programs);
  const likelyIds = results.filter((result) => result.status === "likely").map((result) => result.program.id);
  assert.ok(likelyIds.includes("va-health"));
  assert.ok(likelyIds.includes("scc-veterans-office"));
  assert.ok(likelyIds.includes("care-fera"));
  assert.ok(!likelyIds.includes("valley-water-landscape"));
});

test("every program has an official source and verification date", () => {
  for (const program of programs) {
    assert.match(program.sourceUrl, /^https:\/\//);
    assert.match(program.lastVerified, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(program.sourceSnippet.length > 30);
  }
});
