# Bhavishyawani Engine

A type-safe, purely functional F# domain model and execution engine for
classical Vedic predictive analysis (jyotisha + Samudrika Shastra), designed
to compile to client-side JavaScript via [Fable](https://fable.io).

## The "Zero Bluffing" contract

The engine's verdict type makes vagueness unrepresentable:

```fsharp
type DestinyReading =
    | ExactTimeline of moon: MoonNakshatraPosition * events: TimelineEvent list
    | InsufficientDataForExactPrediction of InsufficiencyReason list
```

There is no third state. Either the classical rules produce dated, witnessed,
cited windows — or the engine refuses with a machine-readable reason naming
the exact deficiency. Concretely:

- **≥ 2 systems or silence.** A `TimelineEvent` is only emitted when at least
  two independent knowledge systems (Parashara dasha chronology, Samudrika
  palm structure, Samudrika body markings) converge on the same window. The
  floor is enforced in code (`RuleMatrix.minimumAlignedSystems`), not by
  convention.
- **Astronomical honesty.** The lunar theory is a truncated principal-term
  series (worst-case ≈ 0.30°) and the Lahiri ayanamsa is a linear model
  (≈ 0.05°). If the natal Moon falls within the combined tolerance (0.40°) of
  a nakshatra boundary, the engine returns
  `MoonOnNakshatraBoundary` instead of guessing — a wrong boundary call would
  shift the whole 120-year dasha chronology by months to years.
- **Auditable events.** Every event carries the concrete `Witnesses` that
  fired the rule, the `SystemsAligned`, and `Sources` — citations into the
  classical corpus from an immutable lookup map (`ClassicalSources.references`).
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

| File | Responsibility |
|---|---|
| `src/Domain.fs` | Input domain: `UserMetrics` (birth data, palm lines/mounts as closed DUs, optional body signs), `DateRange`, `TimelineType`. |
| `src/Astronomy.fs` | Pure astronomical kernel: Julian Day, truncated lunar longitude (Meeus ch. 47), linear Lahiri ayanamsa, natal Moon → nakshatra with boundary distance. |
| `src/VimshottariDasha.fs` | The 120-year Maha → Antar → Pratyantar tree, anchored by the Moon's degree in its natal nakshatra (BPHS dasha balance), clipped at birth, mapped to exact civil dates. |
| `src/ClassicalSources.fs` | `ClassicalSource` citation DU + the immutable `RuleId -> ClassicalSource list` bibliography. |
| `src/RuleMatrix.fs` | The cross-reference matrix: structural gates × dasha gates → `TimelineEvent`, with the two-system floor. |
| `src/Engine.fs` | Validation, the boundary-tolerance gate, and `evaluateDestiny`. |

No external packages. Only `System.DateTime`, `System.TimeSpan`, `Map`,
`Set`, lists and math — all fully supported by Fable, so the whole engine
translates to dependency-free JavaScript.

## Usage

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
| ExactTimeline (moon, events) ->
    printfn "Natal Moon: %s (%.2f° sidereal, %.2f° from nearest boundary)"
        (Astronomy.nakshatraName moon.Nakshatra)
        moon.SiderealLongitude
        moon.DistanceToNearestBoundary
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

### Note on the `evaluateDestiny` signature

The original specification asked for
`evaluateDestiny : UserMetrics -> List<TimelineEvent>`. That signature cannot
also carry the mandated `InsufficientDataForExactPrediction` state — an empty
list is ambiguous (refusal? or simply no alignments?), which is itself a form
of bluffing. The engine therefore returns the closed `DestinyReading` union,
which is the type-safe realisation of both requirements at once. Callers that
need the raw list can match `ExactTimeline (_, events)`.

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

*This project was authored in an environment without the .NET SDK installed,
so it has not yet been compile-verified — run `dotnet build` once before
first use.*

## Extension points

- **Lagna module.** Birth coordinates are already captured and validated but
  are only consumed once an ascendant computation lands; that unlocks true
  BPHS maraka lordship (2nd/7th lords) instead of the current
  natural-malefic approximation documented in `RuleMatrix.fs`.
- **Higher-precision ephemeris.** Swapping `Astronomy.tropicalMoonLongitude`
  for a fuller ELP series shrinks the boundary tolerance and therefore the
  set of refused charts — the refusal gate adjusts automatically because the
  tolerance is a single named constant.
- **More matrix rows.** A rule is one record: a structural gate, a dasha
  gate, a reading template, and a bibliography entry. The two-system floor
  applies to every row automatically.
