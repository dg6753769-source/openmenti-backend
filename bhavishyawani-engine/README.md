# Bhavishyawani Engine

A type-safe, purely functional F# domain model and execution engine for
classical Vedic predictive analysis (jyotisha + Samudrika Shastra), designed
to compile to client-side or Node JavaScript via [Fable](https://fable.io).

## The "Zero Bluffing" contract

The engine's verdict type makes vagueness unrepresentable:

```fsharp
type DestinyReading =
    | ExactTimeline of chart: NatalChart * events: TimelineEvent list
    | InsufficientDataForExactPrediction of InsufficiencyReason list
```

There is no third state. Either the classical rules produce dated, witnessed,
cited windows — or the engine refuses with a machine-readable reason naming
the exact deficiency. Concretely:

- **≥ 2 systems or silence.** A `TimelineEvent` is only emitted when at least
  two independent knowledge systems converge on the same window: Parashara
  dasha chronology, Parashara lagna lordship, Samudrika palm structure,
  Samudrika body markings. The floor is enforced in code
  (`RuleMatrix.minimumAlignedSystems`), not by convention.
- **Astronomical honesty.** The lunar theory is a truncated principal-term
  series (worst-case ≈ 0.30°) and the Lahiri ayanamsa is a linear model
  (≈ 0.05°). If the natal Moon falls within the combined tolerance (0.40°) of
  a nakshatra boundary, the engine returns `MoonOnNakshatraBoundary` instead
  of guessing — a wrong boundary call would shift the whole 120-year dasha
  chronology by months to years. The same discipline applies to the
  ascendant: within 0.50° of a rashi boundary the exact maraka lords are
  withheld (`NaturalFallback`), and inside the polar circles the engine
  refuses outright (`PolarLatitudeUnsupported`) because the rising point
  degenerates there.
- **Auditable events.** Every event carries the concrete `Witnesses` that
  fired the rule, the `SystemsAligned`, and `Sources` — citations into the
  classical corpus from an immutable lookup map
  (`ClassicalSources.references`).
- **Determinism.** The core (`Engine.evaluateDestinyAt`) is a pure function:
  the evaluation instant is a parameter, so identical inputs always yield the
  identical verdict. `Engine.evaluateDestiny` is a thin wrapper pinned to
  `DateTime.UtcNow`.

> **Honest scope note.** "Deterministic" here means the engine applies the
> classical rules of Brihat Parashara Hora Shastra, the Garuda Purana's
> Samudrika chapters, Brihat Samhita and the hasta-rekha corpus with
> mathematical repeatability. It is a faithful, precise encoding of those
> texts — the texts themselves, not this engine, are the claim about the
> world. The engine never manufactures precision the mathematics or the
> corpus cannot support; that is exactly what the
> `InsufficientDataForExactPrediction` branch exists for.

## Architecture

Compilation order (F# files only see what precedes them):

| File | Responsibility |
|---|---|
| `src/Domain.fs` | Input domain: `UserMetrics` (birth data, palm lines/mounts as closed DUs, optional body signs), `DateRange`, `TimelineType`. |
| `src/Astronomy.fs` | Pure astronomical kernel: Julian Day, truncated lunar longitude (Meeus ch. 47), linear Lahiri ayanamsa, natal Moon → nakshatra with boundary distance. |
| `src/VimshottariDasha.fs` | The 120-year Maha → Antar → Pratyantar tree, anchored by the Moon's degree in its natal nakshatra (BPHS dasha balance), clipped at birth, mapped to exact civil dates. |
| `src/Lagna.fs` | Sidereal ascendant from GMST (Meeus ch. 12) + obliquity + birth coordinates; whole-sign rashi; BPHS ch. 44 maraka lords (2nd/7th) with a declared boundary fallback. |
| `src/ClassicalSources.fs` | `ClassicalSource` citation DU + the immutable `RuleId -> ClassicalSource list` bibliography. |
| `src/RuleMatrix.fs` | The cross-reference matrix: structural gates × temporal gates → `TimelineEvent`, with the two-system floor. The maraka rule consumes the lagna-derived lords and contributes a third aligned system when the lagna is exact. |
| `src/Engine.fs` | Validation, the tolerance gates, `NatalChart`, and `evaluateDestiny`. |
| `src/Api.fs` | The JavaScript boundary: plain-primitive DTOs in/out (`Api.evaluate`), Result-typed field parsing, stable string forms, ISO-8601 UTC dates. |

No external packages. Only `System.DateTime`, `System.TimeSpan`, `Map`,
`Set`, lists and math — all fully supported by Fable, so the whole engine
translates to dependency-free JavaScript.

## Usage from F#

```fsharp
open System
open Bhavishyawani

let metrics =
    { BirthData =
        { UtcBirthInstant = DateTime(1990, 3, 14, 2, 30, 0, DateTimeKind.Utc)
          Coordinates = { Latitude = 28.6139; Longitude = 77.2090 } } // New Delhi
      PalmMetrics =
        { Lines =
            Map.ofList
                [ PrimaryLine.LifeLine, LineState.Broken
                  PrimaryLine.FateLine, LineState.Deep
                  PrimaryLine.HeartLine, LineState.Chained ]
          Mounts = Map.ofList [ MountName.Jupiter, MountProminence.High ] }
      PhysicalSigns =
        Some [ { Marking = AuspiciousMarking.Fish; Location = MountName.Jupiter } ] }

match Engine.evaluateDestiny metrics with
| ExactTimeline (chart, events) ->
    printfn "Moon: %s | Lagna: %s"
        (Astronomy.nakshatraName chart.Moon.Nakshatra)
        (Lagna.rashiName chart.Lagna.Rashi)
    for e in events do
        let kind =
            match e.EventType with
            | TimelineType.PastVerification -> "PAST  "
            | TimelineType.FuturePrediction -> "FUTURE"
        printfn "[%s] %O → %O\n  %s"
            kind e.Period.RangeStart e.Period.RangeEnd e.StructuralReading
        for source in e.Sources do
            printfn "  · %s" (ClassicalSources.citation source)
| InsufficientDataForExactPrediction reasons ->
    // The honest branch: name what is missing, offer nothing else.
    for r in reasons do printfn "Refused: %A" r
```

## Usage from JavaScript (via Fable)

`Api.evaluate` takes and returns plain objects — no F# types cross the
boundary. After compiling with Fable (see Building):

```js
import { evaluate } from "./dist/Api.js";

const reading = evaluate({
  birthUtc: { year: 1990, month: 3, day: 14, hourUtc: 2, minuteUtc: 30, secondUtc: 0 },
  latitude: 28.6139,
  longitude: 77.209,
  heartLine: "Chained",  // "" means "not observed" — never guess
  headLine: "",
  lifeLine: "Broken",
  fateLine: "Deep",
  jupiterMount: "High",
  saturnMount: "",
  sunMount: "",
  mercuryMount: "",
  signs: [{ marking: "Fish", location: "Jupiter" }],
});

switch (reading.status) {
  case "ExactTimeline":
    console.log(reading.moonNakshatra, reading.lagnaRashi, reading.marakaBasis);
    for (const e of reading.events) {
      console.log(`[${e.eventType}] ${e.startUtcIso} → ${e.endUtcIso}`);
      console.log(`  ${e.reading}`);
      e.sources.forEach((s) => console.log(`  · ${s}`));
    }
    break;
  case "InsufficientData": // the engine refused, with named reasons
  case "InvalidInput":     // malformed fields, one error per field
    reading.reasons.forEach((r) => console.log("Refused:", r));
    break;
}
```

## Verification

Two independent harnesses:

- `tests/KernelChecks.fsx` — run `dotnet fsi tests/KernelChecks.fsx`. Asserts
  the astronomical kernel against Meeus worked examples (Julian Day, lunar
  longitude, GMST), the Vimshottari invariants (contiguity, BPHS pratyantar
  anchoring, 120-year sum), BPHS maraka lordship per rashi, the end-to-end
  engine contract (≥2 systems per event, citations present, deterministic
  replay, explicit refusals), and the DTO boundary (round-trip + per-field
  `InvalidInput` errors). Exits non-zero on any failure.
- A JavaScript mirror of the numeric kernel was validated during development:
  Julian Day exact on textbook values; lunar longitude within 0.09° of the
  Meeus full-theory example (inside the stated 0.30° bound); GMST matching
  Meeus ch. 12 to 5 decimals; ascendant identities at the equator exact and
  the ascendant sweeping a monotonic 360°/day.

*This project was authored in an environment without the .NET SDK installed,
so the F# itself has not been compile-verified — run `dotnet build` and
`dotnet fsi tests/KernelChecks.fsx` once before first use.*

## Building

.NET (type-check / library build):

```bash
dotnet build bhavishyawani-engine/Bhavishyawani.fsproj
```

Fable (JavaScript output):

```bash
dotnet tool install --global fable
cd bhavishyawani-engine
fable . --outDir ./dist
```

### Note on the `evaluateDestiny` signature

The original specification asked for
`evaluateDestiny : UserMetrics -> List<TimelineEvent>`. That signature cannot
also carry the mandated `InsufficientDataForExactPrediction` state — an empty
list is ambiguous (refusal? or simply no alignments?), which is itself a form
of bluffing. The engine therefore returns the closed `DestinyReading` union,
which is the type-safe realisation of both requirements at once. Callers that
need the raw list can match `ExactTimeline (_, events)`.

## Extension points

- **Higher-precision ephemeris.** Swapping `Astronomy.tropicalMoonLongitude`
  for a fuller ELP series shrinks the boundary tolerance and therefore the
  set of refused charts — the refusal gate adjusts automatically because the
  tolerance is a single named constant.
- **Graha positions beyond the Moon.** With planetary longitudes computed,
  the matrix could admit transit- and yoga-based rules; the `SystemWitness` /
  `KnowledgeSystem` types are designed to grow by case, not by rewrite.
- **More matrix rows.** A rule is one record: a structural gate, a temporal
  gate, a reading template, and a bibliography entry. The two-system floor
  applies to every row automatically.
