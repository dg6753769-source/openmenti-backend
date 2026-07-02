// =============================================================================
// Kernel verification script — run with:  dotnet fsi tests/KernelChecks.fsx
//
// Checks the astronomical kernel against published reference values (Meeus,
// "Astronomical Algorithms" worked examples), the Vimshottari invariants, and
// the end-to-end engine contract, printing PASS/FAIL per assertion and
// exiting non-zero on any failure.
// =============================================================================

#load "../src/Domain.fs"
#load "../src/Astronomy.fs"
#load "../src/VimshottariDasha.fs"
#load "../src/Lagna.fs"
#load "../src/ClassicalSources.fs"
#load "../src/RuleMatrix.fs"
#load "../src/Engine.fs"
#load "../src/Api.fs"

open System
open Bhavishyawani

let mutable failures = 0

let check (name: string) (condition: bool) =
    if condition then
        printfn "PASS  %s" name
    else
        failures <- failures + 1
        printfn "FAIL  %s" name

let approx (tolerance: float) (expected: float) (actual: float) =
    abs (expected - actual) <= tolerance

// ---------------------------------------------------------------- Julian Day
check "JD of 2000-01-01 12:00 UTC = 2451545.0"
    (Astronomy.julianDay (DateTime(2000, 1, 1, 12, 0, 0, DateTimeKind.Utc)) = 2451545.0)
check "JD of 1987-06-19 12:00 UTC = 2446966.0 (Meeus ch. 7)"
    (Astronomy.julianDay (DateTime(1987, 6, 19, 12, 0, 0, DateTimeKind.Utc)) = 2446966.0)

// ------------------------------------------------------------ Lunar theory
// Meeus ch. 47 worked example: 1992-04-12 00:00 TT, apparent lambda = 133.163°.
// The truncated series must land within its stated 0.30° bound.
let jdMeeus = Astronomy.julianDay (DateTime(1992, 4, 12, 0, 0, 0, DateTimeKind.Utc))
check "Moon tropical longitude 1992-04-12 within 0.30° of Meeus 133.163°"
    (approx 0.30 133.163 (Astronomy.tropicalMoonLongitude jdMeeus))

// --------------------------------------------------------------- Ayanamsa
check "Lahiri ayanamsa at J2000 ≈ 23.853°"
    (approx 0.001 23.85319 (Astronomy.lahiriAyanamsa Astronomy.J2000))

// ------------------------------------------------------------ Sidereal time
// Meeus ch. 12 worked example: 1987-04-10 19:21:00 UT, mean GST = 128.73787°.
let jdSidereal = Astronomy.julianDay (DateTime(1987, 4, 10, 19, 21, 0, DateTimeKind.Utc))
check "GMST 1987-04-10 19:21 UT within 0.01° of Meeus 128.73787°"
    (approx 0.01 128.73787 (Lagna.gmstDegrees jdSidereal))
check "Mean obliquity at J2000 ≈ 23.4393°"
    (approx 0.001 23.4392911 (Lagna.meanObliquity Astronomy.J2000))

// ---------------------------------------------------------- Vimshottari
check "Dasha years sum to exactly 120"
    (Vimshottari.lordCycle |> Array.sumBy Vimshottari.dashaYears = 120.0)
check "Chitra's Vimshottari lord is Mangala (classical table)"
    (Vimshottari.nakshatraLord Nakshatra.Chitra = Graha.Mars)
check "Ashwini's Vimshottari lord is Ketu (cycle anchor)"
    (Vimshottari.nakshatraLord Nakshatra.Ashwini = Graha.Ketu)

let demoBirth = DateTime(1990, 3, 14, 2, 30, 0, DateTimeKind.Utc)
let demoMoon = Astronomy.moonNakshatraAt demoBirth
let timeline = Vimshottari.buildTimeline demoBirth demoMoon
check "Timeline spans the full residual 120 years (9 clipped mahas)"
    (List.length timeline = 9)
check "Maha periods are contiguous"
    (timeline
     |> List.pairwise
     |> List.forall (fun (a, b) -> a.MahaPeriod.RangeEnd = b.MahaPeriod.RangeStart))
check "First maha starts exactly at birth"
    ((List.head timeline).MahaPeriod.RangeStart = demoBirth)
check "Every antar's first pratyantar is ruled by the antar lord (BPHS)"
    (timeline
     |> List.collect (fun m -> m.Antars)
     |> List.forall (fun a ->
         match a.Pratyantars with
         | first :: _ -> first.PratyantarLord = a.AntarLord || a.AntarPeriod.RangeStart = demoBirth
         | [] -> false))

// --------------------------------------------------------------- Marakas
// Mesha lagna: 2nd = Vrishabha (Venus), 7th = Tula (Venus) -> [Venus].
let meshaLagna =
    { Rashi = Rashi.Mesha; SiderealLongitude = 15.0; DistanceToRashiBoundary = 15.0 }
check "Mesha lagna marakas = [Shukra] (BPHS 2nd/7th lords, deduplicated)"
    (Lagna.determineMarakas 0.5 meshaLagna = MarakaDetermination.ExactFromLagna(Rashi.Mesha, [ Graha.Venus ]))
// Karka lagna: 2nd = Simha (Sun), 7th = Makara (Saturn).
let karkaLagna =
    { Rashi = Rashi.Karka; SiderealLongitude = 105.0; DistanceToRashiBoundary = 15.0 }
check "Karka lagna marakas = [Surya; Shani]"
    (Lagna.determineMarakas 0.5 karkaLagna
     = MarakaDetermination.ExactFromLagna(Rashi.Karka, [ Graha.Sun; Graha.Saturn ]))
// Boundary case: exact lords withheld.
let boundaryLagna =
    { Rashi = Rashi.Mesha; SiderealLongitude = 29.9; DistanceToRashiBoundary = 0.1 }
check "Lagna 0.1° from a boundary yields NaturalFallback"
    (match Lagna.determineMarakas 0.5 boundaryLagna with
     | MarakaDetermination.NaturalFallback _ -> true
     | _ -> false)

// --------------------------------------------------------- End-to-end engine
let evaluationInstant = DateTime(2026, 7, 2, 0, 0, 0, DateTimeKind.Utc)

let demoMetrics =
    { BirthData =
        { UtcBirthInstant = demoBirth
          Coordinates = { Latitude = 28.6139; Longitude = 77.2090 } }
      PalmMetrics =
        { Lines =
            Map.ofList
                [ PrimaryLine.LifeLine, LineState.Broken
                  PrimaryLine.FateLine, LineState.Deep
                  PrimaryLine.HeartLine, LineState.Chained ]
          Mounts = Map.ofList [ MountName.Jupiter, MountProminence.High ] }
      PhysicalSigns = Some [ { Marking = AuspiciousMarking.Fish; Location = MountName.Jupiter } ] }

match Engine.evaluateDestinyAt evaluationInstant demoMetrics with
| ExactTimeline (chart, events) ->
    check "Demo chart yields an exact timeline" true
    check "Every event aligns >= 2 systems"
        (events |> List.forall (fun e -> List.length e.SystemsAligned >= 2))
    check "Every event is cited"
        (events |> List.forall (fun e -> not (List.isEmpty e.Sources)))
    check "Events are chronologically sorted"
        (events
         |> List.pairwise
         |> List.forall (fun (a, b) -> a.Period.RangeStart <= b.Period.RangeStart))
    check "Past/future split matches the evaluation instant"
        (events
         |> List.forall (fun e ->
             match e.EventType with
             | TimelineType.PastVerification -> e.Period.RangeEnd <= evaluationInstant
             | TimelineType.FuturePrediction -> e.Period.RangeEnd > evaluationInstant))
    printfn "      chart: Moon %s / Lagna %s"
        (Astronomy.nakshatraName chart.Moon.Nakshatra)
        (Lagna.rashiName chart.Lagna.Rashi)
| InsufficientDataForExactPrediction reasons ->
    // Legitimate if this particular natal Moon sits on a boundary — but then
    // the reason must say exactly that and nothing else.
    check "Refusal carries only the boundary reason"
        (match reasons with
         | [ InsufficiencyReason.MoonOnNakshatraBoundary _ ] -> true
         | _ -> false)

// Determinism: two runs, identical verdict.
check "evaluateDestinyAt is deterministic"
    (Engine.evaluateDestinyAt evaluationInstant demoMetrics
     = Engine.evaluateDestinyAt evaluationInstant demoMetrics)

// Empty palm refuses explicitly.
let emptyPalm =
    { demoMetrics with
        PalmMetrics = { Lines = Map.empty; Mounts = Map.empty }
        PhysicalSigns = None }
check "Empty Samudrika observations refuse with NoPalmParametersObserved"
    (match Engine.evaluateDestinyAt evaluationInstant emptyPalm with
     | InsufficientDataForExactPrediction [ InsufficiencyReason.NoPalmParametersObserved ] -> true
     | _ -> false)

// Polar latitude refuses explicitly.
let polar =
    { demoMetrics with
        BirthData = { demoMetrics.BirthData with Coordinates = { Latitude = 78.0; Longitude = 15.0 } } }
check "Polar latitude refuses with PolarLatitudeUnsupported"
    (match Engine.evaluateDestinyAt evaluationInstant polar with
     | InsufficientDataForExactPrediction reasons ->
         reasons
         |> List.exists (function
             | InsufficiencyReason.PolarLatitudeUnsupported _ -> true
             | _ -> false)
     | _ -> false)

// ------------------------------------------------------------- API boundary
let demoDto: UserMetricsDto =
    { birthUtc = { year = 1990; month = 3; day = 14; hourUtc = 2; minuteUtc = 30; secondUtc = 0 }
      latitude = 28.6139
      longitude = 77.2090
      heartLine = "Chained"
      headLine = ""
      lifeLine = "Broken"
      fateLine = "Deep"
      jupiterMount = "High"
      saturnMount = ""
      sunMount = ""
      mercuryMount = ""
      signs = [| { marking = "Fish"; location = "Jupiter" } |] }

let dtoResult = Api.evaluateAt evaluationInstant demoDto
check "DTO round-trip returns a definitive status"
    (dtoResult.status = "ExactTimeline" || dtoResult.status = "InsufficientData")

let badDto = { demoDto with lifeLine = "Wobbly"; signs = [| { marking = "Star"; location = "Jupiter" } |] }
let badResult = Api.evaluateAt evaluationInstant badDto
check "Malformed DTO fields answer InvalidInput with one error per field"
    (badResult.status = "InvalidInput" && Array.length badResult.reasons = 2)

// ----------------------------------------------------------------- Summary
printfn ""
if failures = 0 then
    printfn "All kernel checks passed."
else
    printfn "%d check(s) FAILED." failures
    exit 1
