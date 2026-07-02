namespace Bhavishyawani

open System

// =============================================================================
// THE JAVASCRIPT BOUNDARY
//
// Fable compiles F# records of primitives to plain JavaScript objects, so
// these DTOs are the entire interop story: a Node/browser caller passes an
// ordinary JSON-shaped object in and receives one back. No Fable.Core
// attributes, no serializer dependency — the Zero-Bluffing policy extends to
// the boundary: unparseable input is answered with status "InvalidInput" and
// a named error per offending field, never a partial reading.
//
// String conventions: an empty string means "not observed" for palm fields;
// output dates are UTC ISO-8601 with an explicit Z suffix.
// =============================================================================

/// Exact UTC birth instant as plain numbers — no string parsing, no timezone
/// ambiguity at the boundary.
type BirthInstantDto =
    { year: int
      month: int
      day: int
      hourUtc: int
      minuteUtc: int
      secondUtc: int }

type SignDto =
    { /// "Lotus" | "Fish" | "Trident" | "Conch" | "Temple"
      marking: string
      /// "Jupiter" | "Saturn" | "Sun" | "Mercury"
      location: string }

type UserMetricsDto =
    { birthUtc: BirthInstantDto
      latitude: float
      longitude: float
      /// "" (unobserved) | "Deep" | "Chained" | "Broken" | "Forked"
      heartLine: string
      headLine: string
      lifeLine: string
      fateLine: string
      /// "" (unobserved) | "High" | "Flat" | "Depressed"
      jupiterMount: string
      saturnMount: string
      sunMount: string
      mercuryMount: string
      signs: SignDto array }

type TimelineEventDto =
    { /// "PastVerification" | "FuturePrediction"
      eventType: string
      ruleId: string
      startUtcIso: string
      endUtcIso: string
      /// Empty strings when no pratyantar peak is available.
      peakStartUtcIso: string
      peakEndUtcIso: string
      ageStart: float
      ageEnd: float
      systemsAligned: string array
      witnesses: string array
      reading: string
      sources: string array }

type ReadingDto =
    { /// "ExactTimeline" | "InsufficientData" | "InvalidInput"
      status: string
      /// Chart summary; empty strings / 0.0 when status <> "ExactTimeline".
      moonNakshatra: string
      moonSiderealLongitude: float
      lagnaRashi: string
      lagnaSiderealLongitude: float
      marakaBasis: string
      events: TimelineEventDto array
      /// Named insufficiency reasons or per-field input errors.
      reasons: string array }

module Api =

    // ------------------------------------------------------------------
    // Stable string forms across the boundary
    // ------------------------------------------------------------------

    let private lineName (l: PrimaryLine) =
        match l with
        | PrimaryLine.HeartLine -> "Heart"
        | PrimaryLine.HeadLine -> "Head"
        | PrimaryLine.LifeLine -> "Life"
        | PrimaryLine.FateLine -> "Fate"

    let private lineStateName (s: LineState) =
        match s with
        | LineState.Deep -> "Deep"
        | LineState.Chained -> "Chained"
        | LineState.Broken -> "Broken"
        | LineState.Forked -> "Forked"

    let private mountName (m: MountName) =
        match m with
        | MountName.Jupiter -> "Jupiter"
        | MountName.Saturn -> "Saturn"
        | MountName.Sun -> "Sun"
        | MountName.Mercury -> "Mercury"

    let private prominenceName (p: MountProminence) =
        match p with
        | MountProminence.High -> "High"
        | MountProminence.Flat -> "Flat"
        | MountProminence.Depressed -> "Depressed"

    let private markingName (m: AuspiciousMarking) =
        match m with
        | AuspiciousMarking.Lotus -> "Lotus"
        | AuspiciousMarking.Fish -> "Fish"
        | AuspiciousMarking.Trident -> "Trident"
        | AuspiciousMarking.Conch -> "Conch"
        | AuspiciousMarking.Temple -> "Temple"

    let private ruleIdName (r: RuleId) =
        match r with
        | RuleId.MarakaWindowOnBrokenLifeLine -> "MarakaWindowOnBrokenLifeLine"
        | RuleId.DharmaKarmaAscent -> "DharmaKarmaAscent"
        | RuleId.SaturnVenusRelationalStrain -> "SaturnVenusRelationalStrain"
        | RuleId.LakshmiProsperityWindow -> "LakshmiProsperityWindow"
        | RuleId.BuddhiCommerceWindow -> "BuddhiCommerceWindow"
        | RuleId.SuryaVitalityWindow -> "SuryaVitalityWindow"

    let private systemName (s: KnowledgeSystem) =
        match s with
        | KnowledgeSystem.ParasharaDasha -> "ParasharaDasha"
        | KnowledgeSystem.ParasharaLagna -> "ParasharaLagna"
        | KnowledgeSystem.SamudrikaPalm -> "SamudrikaPalm"
        | KnowledgeSystem.SamudrikaDeha -> "SamudrikaDeha"

    let private eventTypeName (t: TimelineType) =
        match t with
        | TimelineType.PastVerification -> "PastVerification"
        | TimelineType.FuturePrediction -> "FuturePrediction"

    let private witnessDescription (w: SystemWitness) =
        match w with
        | LineWitness (line, state) ->
            sprintf "%s line: %s" (lineName line) (lineStateName state)
        | MountWitness (mount, prominence) ->
            sprintf "%s mount: %s" (mountName mount) (prominenceName prominence)
        | MarkingWitness sign ->
            sprintf "%s marking on the %s mount" (markingName sign.Marking) (mountName sign.Location)
        | DashaWitness (maha, antar) ->
            sprintf "%s maha-dasha / %s antar-dasha"
                (Vimshottari.grahaName maha) (Vimshottari.grahaName antar)
        | LagnaWitness (lagna, lords) ->
            sprintf "Lagna %s; maraka lords: %s"
                (Lagna.rashiName lagna)
                (lords |> List.map Vimshottari.grahaName |> String.concat ", ")

    let private reasonDescription (r: InsufficiencyReason) =
        match r with
        | InsufficiencyReason.MoonOnNakshatraBoundary (lon, tol) ->
            sprintf
                "Natal Moon at %.3f° sidereal sits within %.2f° of a nakshatra boundary; the opening dasha lord cannot be asserted at the engine's stated precision. A more exact birth time or a higher-precision ephemeris is required."
                lon tol
        | InsufficiencyReason.InvalidCoordinates (lat, lon) ->
            sprintf "Coordinates (%.4f, %.4f) are outside physical range." lat lon
        | InsufficiencyReason.PolarLatitudeUnsupported lat ->
            sprintf
                "Birth latitude %.4f° lies inside the polar circles, where the rising point degenerates; the ascendant cannot be computed honestly."
                lat
        | InsufficiencyReason.BirthInstantOutOfCalibratedRange d ->
            sprintf
                "Birth year %d is outside 1800-2200, the range for which the lunar theory's error bound is stated."
                d.Year
        | InsufficiencyReason.NoPalmParametersObserved ->
            "No palm line, mount or body marking was observed; the Samudrika side of every cross-reference is empty, so no two systems can align."
        | InsufficiencyReason.NoClassicalRuleAlignment n ->
            sprintf
                "All inputs were valid, but none of the %d classical rules found two independent systems in agreement. Silence is the verdict."
                n

    let private marakaBasisDescription (m: MarakaDetermination) =
        match m with
        | MarakaDetermination.ExactFromLagna (lagna, lords) ->
            sprintf "Exact (BPHS 2nd/7th lords of %s): %s"
                (Lagna.rashiName lagna)
                (lords |> List.map Vimshottari.grahaName |> String.concat ", ")
        | MarakaDetermination.NaturalFallback (lon, tol) ->
            sprintf
                "Natural fallback: ascendant %.3f° sidereal is within %.2f° of a rashi boundary, so exact lords are withheld."
                lon tol

    /// Deterministic ISO-8601 UTC formatting, independent of any culture or
    /// format-string runtime behaviour.
    let private isoUtc (d: DateTime) =
        sprintf "%04d-%02d-%02dT%02d:%02d:%02dZ" d.Year d.Month d.Day d.Hour d.Minute d.Second

    // ------------------------------------------------------------------
    // Input parsing (Result-typed; errors name the offending field)
    // ------------------------------------------------------------------

    let private parseLineState (field: string) (raw: string) =
        match raw with
        | "" -> Ok None
        | "Deep" -> Ok(Some LineState.Deep)
        | "Chained" -> Ok(Some LineState.Chained)
        | "Broken" -> Ok(Some LineState.Broken)
        | "Forked" -> Ok(Some LineState.Forked)
        | other ->
            Error(sprintf "%s: unrecognised line state '%s' (expected Deep|Chained|Broken|Forked or empty)" field other)

    let private parseProminence (field: string) (raw: string) =
        match raw with
        | "" -> Ok None
        | "High" -> Ok(Some MountProminence.High)
        | "Flat" -> Ok(Some MountProminence.Flat)
        | "Depressed" -> Ok(Some MountProminence.Depressed)
        | other ->
            Error(sprintf "%s: unrecognised prominence '%s' (expected High|Flat|Depressed or empty)" field other)

    let private parseMarking (raw: string) =
        match raw with
        | "Lotus" -> Ok AuspiciousMarking.Lotus
        | "Fish" -> Ok AuspiciousMarking.Fish
        | "Trident" -> Ok AuspiciousMarking.Trident
        | "Conch" -> Ok AuspiciousMarking.Conch
        | "Temple" -> Ok AuspiciousMarking.Temple
        | other ->
            Error(sprintf "signs.marking: unrecognised marking '%s' (expected Lotus|Fish|Trident|Conch|Temple)" other)

    let private parseMountLocation (raw: string) =
        match raw with
        | "Jupiter" -> Ok MountName.Jupiter
        | "Saturn" -> Ok MountName.Saturn
        | "Sun" -> Ok MountName.Sun
        | "Mercury" -> Ok MountName.Mercury
        | other ->
            Error(sprintf "signs.location: unrecognised mount '%s' (expected Jupiter|Saturn|Sun|Mercury)" other)

    let private parseBirth (b: BirthInstantDto) =
        if b.year < 1800 || b.year > 2200 then
            Error(sprintf "birthUtc.year: %d is outside the calibrated range 1800-2200" b.year)
        elif b.month < 1 || b.month > 12 then
            Error(sprintf "birthUtc.month: %d is not a calendar month" b.month)
        elif b.day < 1 || b.day > DateTime.DaysInMonth(b.year, b.month) then
            Error(sprintf "birthUtc.day: %d is invalid for %04d-%02d" b.day b.year b.month)
        elif b.hourUtc < 0 || b.hourUtc > 23 then
            Error(sprintf "birthUtc.hourUtc: %d is not a valid hour" b.hourUtc)
        elif b.minuteUtc < 0 || b.minuteUtc > 59 then
            Error(sprintf "birthUtc.minuteUtc: %d is not a valid minute" b.minuteUtc)
        elif b.secondUtc < 0 || b.secondUtc > 59 then
            Error(sprintf "birthUtc.secondUtc: %d is not a valid second" b.secondUtc)
        else
            Ok(DateTime(b.year, b.month, b.day, b.hourUtc, b.minuteUtc, b.secondUtc, DateTimeKind.Utc))

    let private parseSign (s: SignDto) =
        match parseMarking s.marking, parseMountLocation s.location with
        | Ok m, Ok loc -> Ok { Marking = m; Location = loc }
        | Error e, Ok _ -> Error [ e ]
        | Ok _, Error e -> Error [ e ]
        | Error e1, Error e2 -> Error [ e1; e2 ]

    /// Validates and lifts the boundary DTO into the typed domain, or reports
    /// every offending field at once.
    let toUserMetrics (dto: UserMetricsDto) : Result<UserMetrics, string list> =
        let birthResult = parseBirth dto.birthUtc

        let lineResults =
            [ PrimaryLine.HeartLine, parseLineState "heartLine" dto.heartLine
              PrimaryLine.HeadLine, parseLineState "headLine" dto.headLine
              PrimaryLine.LifeLine, parseLineState "lifeLine" dto.lifeLine
              PrimaryLine.FateLine, parseLineState "fateLine" dto.fateLine ]

        let mountResults =
            [ MountName.Jupiter, parseProminence "jupiterMount" dto.jupiterMount
              MountName.Saturn, parseProminence "saturnMount" dto.saturnMount
              MountName.Sun, parseProminence "sunMount" dto.sunMount
              MountName.Mercury, parseProminence "mercuryMount" dto.mercuryMount ]

        let signResults = dto.signs |> Array.toList |> List.map parseSign

        let errors =
            (match birthResult with
             | Error e -> [ e ]
             | Ok _ -> [])
            @ (lineResults
               |> List.choose (fun (_, r) ->
                   match r with
                   | Error e -> Some e
                   | Ok _ -> None))
            @ (mountResults
               |> List.choose (fun (_, r) ->
                   match r with
                   | Error e -> Some e
                   | Ok _ -> None))
            @ (signResults
               |> List.collect (fun r ->
                   match r with
                   | Error es -> es
                   | Ok _ -> []))

        match birthResult, errors with
        | Ok birth, [] ->
            let lines =
                lineResults
                |> List.choose (fun (line, r) ->
                    match r with
                    | Ok (Some state) -> Some(line, state)
                    | _ -> None)
                |> Map.ofList
            let mounts =
                mountResults
                |> List.choose (fun (mount, r) ->
                    match r with
                    | Ok (Some prominence) -> Some(mount, prominence)
                    | _ -> None)
                |> Map.ofList
            let signs =
                signResults
                |> List.choose (fun r ->
                    match r with
                    | Ok s -> Some s
                    | Error _ -> None)
            Ok
                { BirthData =
                    { UtcBirthInstant = birth
                      Coordinates = { Latitude = dto.latitude; Longitude = dto.longitude } }
                  PalmMetrics = { Lines = lines; Mounts = mounts }
                  PhysicalSigns = if List.isEmpty signs then None else Some signs }
        | _ -> Error errors

    // ------------------------------------------------------------------
    // Output serialisation
    // ------------------------------------------------------------------

    let private toEventDto (e: TimelineEvent) : TimelineEventDto =
        { eventType = eventTypeName e.EventType
          ruleId = ruleIdName e.RuleId
          startUtcIso = isoUtc e.Period.RangeStart
          endUtcIso = isoUtc e.Period.RangeEnd
          peakStartUtcIso =
            e.PeakFocus |> Option.map (fun p -> isoUtc p.RangeStart) |> Option.defaultValue ""
          peakEndUtcIso =
            e.PeakFocus |> Option.map (fun p -> isoUtc p.RangeEnd) |> Option.defaultValue ""
          ageStart = fst e.AgeSpan
          ageEnd = snd e.AgeSpan
          systemsAligned = e.SystemsAligned |> List.map systemName |> List.toArray
          witnesses = e.Witnesses |> List.map witnessDescription |> List.toArray
          reading = e.StructuralReading
          sources = e.Sources |> List.map ClassicalSources.citation |> List.toArray }

    let private emptyChartDto status (reasons: string list) : ReadingDto =
        { status = status
          moonNakshatra = ""
          moonSiderealLongitude = 0.0
          lagnaRashi = ""
          lagnaSiderealLongitude = 0.0
          marakaBasis = ""
          events = [||]
          reasons = List.toArray reasons }

    let private toReadingDto (reading: DestinyReading) : ReadingDto =
        match reading with
        | ExactTimeline (chart, events) ->
            { status = "ExactTimeline"
              moonNakshatra = Astronomy.nakshatraName chart.Moon.Nakshatra
              moonSiderealLongitude = chart.Moon.SiderealLongitude
              lagnaRashi = Lagna.rashiName chart.Lagna.Rashi
              lagnaSiderealLongitude = chart.Lagna.SiderealLongitude
              marakaBasis = marakaBasisDescription chart.Marakas
              events = events |> List.map toEventDto |> List.toArray
              reasons = [||] }
        | InsufficientDataForExactPrediction reasons ->
            emptyChartDto "InsufficientData" (reasons |> List.map reasonDescription)

    // ------------------------------------------------------------------
    // Public entry points
    // ------------------------------------------------------------------

    /// Pure boundary core: evaluation instant is a parameter.
    let evaluateAt (evaluationInstant: DateTime) (dto: UserMetricsDto) : ReadingDto =
        match toUserMetrics dto with
        | Error errors -> emptyChartDto "InvalidInput" errors
        | Ok metrics -> Engine.evaluateDestinyAt evaluationInstant metrics |> toReadingDto

    /// Convenience entry point pinned to the current instant — the function a
    /// Node/browser caller invokes on the Fable-compiled module.
    let evaluate (dto: UserMetricsDto) : ReadingDto =
        evaluateAt DateTime.UtcNow dto
