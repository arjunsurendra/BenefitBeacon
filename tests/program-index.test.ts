import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { cosineSimilarity, embedLocalText } from "../lib/local-vector";

type SeedProgram = {
  id: string;
  name: string;
  cityScope: string[];
  sourceUrl: string;
  applyUrl: string;
};

const programs = JSON.parse(fs.readFileSync(new URL("../data/programs.seed.json", import.meta.url), "utf8")) as SeedProgram[];

test("demo index contains a bounded authoritative corpus for both cities", () => {
  assert.ok(programs.length >= 30 && programs.length <= 70);
  assert.equal(new Set(programs.map((program) => program.id)).size, programs.length);
  assert.ok(programs.filter((program) => program.cityScope.includes("sunnyvale")).length >= 30);
  assert.ok(programs.filter((program) => program.cityScope.includes("cupertino")).length >= 30);
  for (const program of programs) {
    assert.match(program.sourceUrl, /^https:\/\//);
    assert.match(program.applyUrl, /^https:\/\//);
  }
});

test("index includes tax credits, child care, water rebates, SSI, and Medicare assistance", () => {
  const ids = new Set(programs.map((program) => program.id));
  for (const id of [
    "federal-child-tax-credit",
    "federal-child-dependent-care-credit",
    "federal-earned-income-tax-credit",
    "federal-ssi",
    "federal-medicare-savings-programs",
    "federal-medicare-part-d-extra-help",
    "california-child-dependent-care-credit",
    "california-earned-income-tax-credit",
    "california-young-child-tax-credit",
    "california-subsidized-child-care",
    "valley-water-landscape-rebate",
    "valley-water-graywater-rebate",
    "valley-water-drip-program",
    "valley-water-outdoor-survey",
  ]) {
    assert.ok(ids.has(id), `missing indexed program: ${id}`);
  }
});

test("local vectors are deterministic and favor relevant benefit language", () => {
  const query = embedLocalText("Sunnyvale homeowner needs water rebate and irrigation help");
  const water = embedLocalText("Valley Water landscape irrigation conservation rebate for homeowners");
  const unrelated = embedLocalText("veterans pension wartime military income benefit");
  assert.deepEqual(query, embedLocalText("Sunnyvale homeowner needs water rebate and irrigation help"));
  assert.ok(cosineSimilarity(query, water) > cosineSimilarity(query, unrelated));
});
