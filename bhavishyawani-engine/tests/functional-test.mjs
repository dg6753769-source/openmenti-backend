// Functional test of the ACTUAL product: the F# engine compiled to JS by Fable.
import { Api_evaluateAt, Api_evaluate } from "../dist/src/Api.js";

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
};

const evalInstant = new Date(Date.UTC(2026, 6, 2)); // 2026-07-02

const demo = {
  birthUtc: { year: 1990, month: 3, day: 14, hourUtc: 2, minuteUtc: 30, secondUtc: 0 },
  latitude: 28.6139,
  longitude: 77.209,
  heartLine: "Chained",
  headLine: "",
  lifeLine: "Broken",
  fateLine: "Deep",
  jupiterMount: "High",
  saturnMount: "",
  sunMount: "",
  mercuryMount: "",
  signs: [{ marking: "Fish", location: "Jupiter" }],
};

// ---- 1. Happy path: exact timeline with audited events ----
const r = Api_evaluateAt(evalInstant, demo);
check("status is ExactTimeline", r.status === "ExactTimeline");
check("moon nakshatra is Chitra (validated reference)", r.moonNakshatra === "Chitra");
check("lagna rashi is Meena (validated reference)", r.lagnaRashi.startsWith("Meena"));
check("maraka basis names exact BPHS lords", r.marakaBasis.includes("Exact") && r.marakaBasis.includes("Mangala") && r.marakaBasis.includes("Budha"));
check("events emitted", r.events.length > 0);
check("every event aligns >= 2 systems", r.events.every(e => e.systemsAligned.length >= 2));
check("every event is cited", r.events.every(e => e.sources.length > 0));
check("every event carries witnesses", r.events.every(e => e.witnesses.length >= 2));
check("dates are ISO-8601 UTC", r.events.every(e => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(e.startUtcIso)));
check("chronologically sorted", r.events.every((e, i) => i === 0 || r.events[i-1].startUtcIso <= e.startUtcIso));
check("past/future split at evaluation instant", r.events.every(e =>
  e.eventType === "PastVerification" ? new Date(e.endUtcIso) <= evalInstant : new Date(e.endUtcIso) > evalInstant));
const hasPast = r.events.some(e => e.eventType === "PastVerification");
const hasFuture = r.events.some(e => e.eventType === "FuturePrediction");
check("timeline contains PAST verification windows", hasPast);
check("timeline contains FUTURE prediction windows", hasFuture);
check("maraka events cite lagna witness (3-system alignment)",
  r.events.filter(e => e.ruleId === "MarakaWindowOnBrokenLifeLine")
          .every(e => e.systemsAligned.includes("ParasharaLagna")));

// ---- 2. Determinism: identical inputs -> identical verdict ----
const r2 = Api_evaluateAt(evalInstant, demo);
check("deterministic replay", JSON.stringify(r) === JSON.stringify(r2));

// ---- 3. Zero-bluffing refusals ----
const empty = { ...demo, heartLine: "", lifeLine: "", fateLine: "", jupiterMount: "", signs: [] };
const rEmpty = Api_evaluateAt(evalInstant, empty);
check("empty palm refuses (InsufficientData)", rEmpty.status === "InsufficientData");
check("refusal names the deficiency", rEmpty.reasons.length === 1 && rEmpty.reasons[0].includes("No palm line"));
check("refusal carries zero events", rEmpty.events.length === 0);

const polar = { ...demo, latitude: 78.0 };
const rPolar = Api_evaluateAt(evalInstant, polar);
check("polar birth refuses", rPolar.status === "InsufficientData" && rPolar.reasons[0].includes("polar"));

const ancient = { ...demo, birthUtc: { ...demo.birthUtc, year: 1750 } };
const rAncient = Api_evaluateAt(evalInstant, ancient);
check("out-of-calibration year answers InvalidInput", rAncient.status === "InvalidInput");

// ---- 4. Input validation: one named error per bad field ----
const bad = { ...demo, lifeLine: "Wobbly", signs: [{ marking: "Star", location: "Jupiter" }] };
const rBad = Api_evaluateAt(evalInstant, bad);
check("malformed fields answer InvalidInput", rBad.status === "InvalidInput");
check("one error per offending field", rBad.reasons.length === 2);
check("errors name the fields", rBad.reasons.some(e => e.includes("lifeLine")) && rBad.reasons.some(e => e.includes("marking")));

const badDay = { ...demo, birthUtc: { ...demo.birthUtc, month: 2, day: 30 } };
check("impossible calendar date rejected", Api_evaluateAt(evalInstant, badDay).status === "InvalidInput");

// ---- 5. evaluate() convenience entry point works ----
check("evaluate() (UtcNow) returns definitive status", ["ExactTimeline", "InsufficientData"].includes(Api_evaluate(demo).status));

// ---- Sample output for the human ----
console.log("\n===== SAMPLE PRODUCT OUTPUT =====");
console.log(`Moon: ${r.moonNakshatra} (${r.moonSiderealLongitude.toFixed(2)}° sidereal)`);
console.log(`Lagna: ${r.lagnaRashi} (${r.lagnaSiderealLongitude.toFixed(2)}° sidereal)`);
console.log(`Marakas: ${r.marakaBasis}`);
console.log(`Events: ${r.events.length} (${r.events.filter(e => e.eventType === "PastVerification").length} past / ${r.events.filter(e => e.eventType === "FuturePrediction").length} future)\n`);
for (const e of [r.events.find(e => e.eventType === "PastVerification"), r.events.find(e => e.eventType === "FuturePrediction")]) {
  if (!e) continue;
  console.log(`[${e.eventType}] ${e.startUtcIso} -> ${e.endUtcIso} (age ${e.ageStart.toFixed(1)}-${e.ageEnd.toFixed(1)})`);
  console.log(`  systems: ${e.systemsAligned.join(" + ")}`);
  console.log(`  ${e.reading}`);
  e.sources.forEach(s => console.log(`  · ${s}`));
  console.log();
}

console.log(failures === 0 ? "ALL FUNCTIONAL TESTS PASSED" : `${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
