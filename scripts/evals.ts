import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scanSource } from "../src/lib/detectors/scan";

interface FixtureExpectation {
  file: string;
  expectedRuleIds: string[];
}

const FIXTURES_DIR = join(__dirname, "..", "fixtures");

function loadExpectations(): FixtureExpectation[] {
  const raw = readFileSync(join(FIXTURES_DIR, "expected.json"), "utf8");
  return JSON.parse(raw) as FixtureExpectation[];
}

interface FixtureResult {
  file: string;
  expected: Set<string>;
  actual: Set<string>;
  truePositives: string[];
  falsePositives: string[];
  falseNegatives: string[];
}

function evaluateFixture(expectation: FixtureExpectation): FixtureResult {
  const source = readFileSync(join(FIXTURES_DIR, expectation.file), "utf8");
  const { findings, parseError } = scanSource(expectation.file, source);
  if (parseError) throw new Error(`fixture ${expectation.file} failed to parse: ${parseError}`);

  const expected = new Set(expectation.expectedRuleIds);
  const actual = new Set(findings.map((f) => f.ruleId));

  return {
    file: expectation.file,
    expected,
    actual,
    truePositives: [...actual].filter((id) => expected.has(id)),
    falsePositives: [...actual].filter((id) => !expected.has(id)),
    falseNegatives: [...expected].filter((id) => !actual.has(id)),
  };
}

function main() {
  const expectations = loadExpectations();
  const results = expectations.map(evaluateFixture);

  let totalTp = 0;
  let totalFp = 0;
  let totalFn = 0;
  let exactMatches = 0;

  for (const result of results) {
    totalTp += result.truePositives.length;
    totalFp += result.falsePositives.length;
    totalFn += result.falseNegatives.length;
    const isExactMatch = result.falsePositives.length === 0 && result.falseNegatives.length === 0;
    if (isExactMatch) exactMatches += 1;

    const status = isExactMatch ? "PASS" : "FAIL";
    console.log(`${status}  ${result.file}`);
    for (const id of result.falseNegatives) console.log(`      missed:      ${id}`);
    for (const id of result.falsePositives) console.log(`      unexpected:  ${id}`);
  }

  const precision = totalTp + totalFp === 0 ? 1 : totalTp / (totalTp + totalFp);
  const recall = totalTp + totalFn === 0 ? 1 : totalTp / (totalTp + totalFn);
  const fixtureAccuracy = exactMatches / results.length;

  console.log("");
  console.log(`fixtures: ${exactMatches}/${results.length} exact match (${(fixtureAccuracy * 100).toFixed(1)}%)`);
  console.log(`findings: ${totalTp} true positive, ${totalFp} false positive, ${totalFn} false negative`);
  console.log(`precision: ${(precision * 100).toFixed(1)}%  recall: ${(recall * 100).toFixed(1)}%`);

  // A missed finding (false negative) is the dangerous failure mode for a
  // security scanner - a false positive costs someone a few minutes of
  // review, a false negative ships a real bug. Gate strictly on recall;
  // precision is reported but doesn't fail the run.
  if (recall < 1) {
    console.error("\nFAILED: at least one real finding in the corpus was missed.");
    process.exit(1);
  }
}

main();
