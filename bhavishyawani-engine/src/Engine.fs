namespace Bhavishyawani

open System

// =============================================================================
// THE EXECUTION ENGINE
//
// The single public entry point. The verdict is a closed union: either an
// exact timeline backed by named witnesses and named texts, or an explicit,
// reasoned refusal. There is no third state and no generic filler branch —
// the type system makes bluffing unrepresentable.
// =============================================================================

/// Why the engine refuses to answer. Each case names the exact deficiency so
/// the caller knows precisely what observation would unlock a verdict.
[<RequireQualifiedAccess>]
type InsufficiencyReason =
    /// The natal Moon sits closer to a nakshatra boundary than the combined
    /// error bound of the astronomical kernel. The opening dasha lord —
    /// hence the entire 120-year chronology — cannot be asserted honestly.
    | MoonOnNakshatraBoundary of siderealLongitude: float * toleranceDegrees: float
    /// Latitude/longitude outside physical range.
    | InvalidCoordinates of latitude: float * longitude: float
    /// Inside the polar circles the rising point degenerates; the ascendant
    /// formula cannot be trusted there and the engine will not pretend.
    | PolarLatitudeUnsupported of latitude: float
    /// Outside the years for which the lunar theory's error bound is stated.
    | BirthInstantOutOfCalibratedRange of DateTime
    /// No line, mount or marking was observed at all: the Samudrika side of
    /// every cross-reference is empty, so no two systems can ever align.
    | NoPalmParametersObserved
    /// All inputs were valid, yet no classical rule found two independent
    /// systems in agreement. Silence is the correct verdict.
    | NoClassicalRuleAlignment of rulesEvaluated: int

/// The computed skeleton of the chart: what the mathematics fixed before any
/// rule was consulted. Carried on every successful verdict for auditability.
type NatalChart =
    { Moon: MoonNakshatraPosition
      Lagna: LagnaPosition
      Marakas: MarakaDetermination }

/// The engine's verdict.
type DestinyReading =
    | ExactTimeline of chart: NatalChart * events: TimelineEvent list
    | InsufficientDataForExactPrediction of InsufficiencyReason list

module Engine =

    /// Combined worst-case error of the truncated lunar theory (≈ 0.30°) and
    /// the linear Lahiri model (≈ 0.05°), rounded up. Within this distance of
    /// a nakshatra boundary the engine refuses to guess, because a wrong
    /// boundary call shifts the whole dasha chronology by months to years.
    [<Literal>]
    let NakshatraBoundaryToleranceDegrees = 0.40

    /// If the ascendant falls within this distance of a rashi boundary the
    /// exact maraka lords are withheld (see Lagna.determineMarakas). This is
    /// a degradation, not a refusal: the maraka rule falls back to the
    /// natural maraka grahas and declares that basis in its reading.
    [<Literal>]
    let LagnaBoundaryToleranceDegrees = 0.50

    /// Rising-point computation is not defended inside the polar circles.
    [<Literal>]
    let MaxSupportedAbsoluteLatitude = 66.5

    let private validate (m: UserMetrics) : InsufficiencyReason list =
        let birth = m.BirthData.UtcBirthInstant
        let c = m.BirthData.Coordinates
        [ if c.Latitude < -90.0 || c.Latitude > 90.0
             || c.Longitude < -180.0 || c.Longitude > 180.0 then
              yield InsufficiencyReason.InvalidCoordinates(c.Latitude, c.Longitude)
          elif abs c.Latitude > MaxSupportedAbsoluteLatitude then
              yield InsufficiencyReason.PolarLatitudeUnsupported c.Latitude
          if birth.Year < 1800 || birth.Year > 2200 then
              yield InsufficiencyReason.BirthInstantOutOfCalibratedRange birth
          if Map.isEmpty m.PalmMetrics.Lines
             && Map.isEmpty m.PalmMetrics.Mounts
             && (m.PhysicalSigns |> Option.defaultValue [] |> List.isEmpty) then
              yield InsufficiencyReason.NoPalmParametersObserved ]

    /// Pure core: the evaluation instant is a parameter, so identical inputs
    /// always produce the identical verdict — testable, replayable, honest.
    let evaluateDestinyAt (evaluationInstant: DateTime) (metrics: UserMetrics) : DestinyReading =
        match validate metrics with
        | (_ :: _) as reasons -> InsufficientDataForExactPrediction reasons
        | [] ->
            let birth = metrics.BirthData.UtcBirthInstant
            let moon = Astronomy.moonNakshatraAt birth
            if moon.DistanceToNearestBoundary < NakshatraBoundaryToleranceDegrees then
                InsufficientDataForExactPrediction
                    [ InsufficiencyReason.MoonOnNakshatraBoundary(
                          moon.SiderealLongitude,
                          NakshatraBoundaryToleranceDegrees) ]
            else
                let lagna = Lagna.lagnaAt birth metrics.BirthData.Coordinates
                let marakas = Lagna.determineMarakas LagnaBoundaryToleranceDegrees lagna
                let chart = { Moon = moon; Lagna = lagna; Marakas = marakas }
                let timeline = Vimshottari.buildTimeline birth moon
                let events =
                    RuleMatrix.run evaluationInstant metrics { Marakas = marakas } timeline
                if List.isEmpty events then
                    InsufficientDataForExactPrediction
                        [ InsufficiencyReason.NoClassicalRuleAlignment(List.length RuleMatrix.rules) ]
                else
                    ExactTimeline(chart, events |> List.sortBy (fun e -> e.Period.RangeStart))

    /// Convenience entry point pinned to the current instant. Past windows
    /// come back as PastVerification (trust establishment), later windows as
    /// FuturePrediction.
    let evaluateDestiny (metrics: UserMetrics) : DestinyReading =
        evaluateDestinyAt DateTime.UtcNow metrics
