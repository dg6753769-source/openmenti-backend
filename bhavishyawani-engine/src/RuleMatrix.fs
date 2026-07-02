namespace Bhavishyawani

open System

// =============================================================================
// 3. THE CROSS-REFERENCE MATRIX
//
// A prediction is emitted ONLY when at least two independent knowledge
// systems converge on the same window:
//
//   ParasharaDasha  — temporal evidence from the Vimshottari clock
//   ParasharaLagna  — lordship evidence from the computed ascendant
//   SamudrikaPalm   — structural evidence from lines and mounts
//   SamudrikaDeha   — structural evidence from auspicious body markings
//
// Each rule declares (a) a structural gate that either yields concrete
// witnesses or nothing at all, and (b) a temporal gate over (maha, antar)
// lord pairs that likewise yields witnesses or nothing. No gate, no event.
// No filler text exists anywhere in this file: every reading is composed
// from the exact parameters that fired the rule.
// =============================================================================

/// Which classical system contributed a piece of evidence.
[<RequireQualifiedAccess>]
type KnowledgeSystem =
    | ParasharaDasha
    | ParasharaLagna
    | SamudrikaPalm
    | SamudrikaDeha

/// A concrete piece of evidence that fired a rule — kept on the event so a
/// caller (or the native) can audit exactly why the window was flagged.
type SystemWitness =
    | LineWitness of PrimaryLine * LineState
    | MountWitness of MountName * MountProminence
    | MarkingWitness of PhysicalSign
    | DashaWitness of mahaLord: Graha * antarLord: Graha
    | LagnaWitness of lagna: Rashi * marakaLords: Graha list

/// Chart-level facts the temporal gates may consult.
type DashaContext =
    { Marakas: MarakaDetermination }

type TimelineEvent =
    { EventType: TimelineType
      RuleId: RuleId
      /// The exact antar-dasha window the systems converged on.
      Period: DateRange
      /// Narrower peak: the opening pratyantar of the window, which BPHS
      /// assigns to the antar lord itself.
      PeakFocus: DateRange option
      /// Age of the native across the window, in mean solar years.
      AgeSpan: float * float
      Witnesses: SystemWitness list
      SystemsAligned: KnowledgeSystem list
      StructuralReading: string
      Sources: ClassicalSource list }

/// One row of the matrix.
type CrossReferenceRule =
    { Id: RuleId
      /// Non-temporal gate: Some witnesses iff the demanded palm/body
      /// configuration is actually observed. None means the rule is inert.
      StructuralGate: UserMetrics -> SystemWitness list option
      /// Temporal gate over (maha lord, antar lord), with chart context:
      /// Some witnesses iff the window satisfies the rule.
      TemporalGate: DashaContext -> Graha -> Graha -> SystemWitness list option
      /// Deterministic reading: (context, maha, antar, ageStart, ageEnd).
      Reading: DashaContext -> Graha -> Graha -> float -> float -> string }

module RuleMatrix =

    // ------------------------------------------------------------------
    // Structural gate combinators
    // ------------------------------------------------------------------

    let private lineIs (line: PrimaryLine) (state: LineState) (m: UserMetrics) =
        match Map.tryFind line m.PalmMetrics.Lines with
        | Some observed when observed = state -> Some(LineWitness(line, state))
        | _ -> None

    let private mountIs (mount: MountName) (prominence: MountProminence) (m: UserMetrics) =
        match Map.tryFind mount m.PalmMetrics.Mounts with
        | Some observed when observed = prominence -> Some(MountWitness(mount, prominence))
        | _ -> None

    let private markingOn (markings: AuspiciousMarking list) (locations: MountName list) (m: UserMetrics) =
        m.PhysicalSigns
        |> Option.defaultValue []
        |> List.tryFind (fun s ->
            List.contains s.Marking markings && List.contains s.Location locations)
        |> Option.map MarkingWitness

    /// All sub-gates must yield a witness, or the whole gate yields nothing.
    let private allOf (gates: (UserMetrics -> SystemWitness option) list) (m: UserMetrics) =
        let hits = gates |> List.map (fun g -> g m)
        if hits |> List.forall Option.isSome then Some(hits |> List.choose id)
        else None

    // ------------------------------------------------------------------
    // Temporal gate combinators
    // ------------------------------------------------------------------

    /// Lifts a plain (maha, antar) predicate into a temporal gate whose only
    /// witness is the dasha window itself.
    let private dashaOnly (predicate: Graha -> Graha -> bool) =
        fun (_: DashaContext) (maha: Graha) (antar: Graha) ->
            if predicate maha antar then Some [ DashaWitness(maha, antar) ] else None

    let private grahaName = Vimshottari.grahaName

    // ------------------------------------------------------------------
    // The matrix
    // ------------------------------------------------------------------

    /// Fallback maraka set when the lagna could not be resolved exactly:
    /// the natural maraka-natured grahas of the classical tradition.
    let private naturalMarakas = Set.ofList [ Graha.Saturn; Graha.Mars ]

    /// The nodes act as maraka agents (chhidra grahas) but never anchor a
    /// window on their own.
    let private isNode g = g = Graha.Rahu || g = Graha.Ketu

    let rules: CrossReferenceRule list =
        [ // -- Broken Life line × maraka dasha window --------------------
          { Id = RuleId.MarakaWindowOnBrokenLifeLine
            StructuralGate = allOf [ lineIs PrimaryLine.LifeLine LineState.Broken ]
            TemporalGate =
                fun ctx maha antar ->
                    let lords, lagnaWitnesses =
                        match ctx.Marakas with
                        | MarakaDetermination.ExactFromLagna (lagna, lords) ->
                            Set.ofList lords, [ LagnaWitness(lagna, lords) ]
                        | MarakaDetermination.NaturalFallback _ ->
                            naturalMarakas, []
                    let isLord g = Set.contains g lords
                    let isAgent g = isLord g || isNode g
                    if (isLord maha && isAgent antar) || (isLord antar && isAgent maha) then
                        Some(DashaWitness(maha, antar) :: lagnaWitnesses)
                    else
                        None
            Reading =
                fun ctx maha antar a0 a1 ->
                    let basis =
                        match ctx.Marakas with
                        | MarakaDetermination.ExactFromLagna (lagna, lords) ->
                            sprintf
                                "the maraka lords of the natal %s lagna (%s; BPHS 2nd/7th lordship)"
                                (Lagna.rashiName lagna)
                                (lords |> List.map grahaName |> String.concat ", ")
                        | MarakaDetermination.NaturalFallback _ ->
                            "the natural maraka-natured grahas (ascendant too near a rashi boundary; exact lords withheld)"
                    sprintf
                        "Critical vigilance window, ages %.1f to %.1f: the Life line is Broken (Samudrika) while the Vimshottari clock runs the %s maha-dasha with the %s antar-dasha — a period governed by %s. Independent systems converge on a trial of health and vitality in exactly this span; physical risk and neglected ailments must be guarded against."
                        a0 a1 (grahaName maha) (grahaName antar) basis }

          // -- Deep Fate line × high Guru mount × Guru maha-dasha --------
          { Id = RuleId.DharmaKarmaAscent
            StructuralGate =
                allOf
                    [ lineIs PrimaryLine.FateLine LineState.Deep
                      mountIs MountName.Jupiter MountProminence.High ]
            TemporalGate =
                dashaOnly (fun maha antar ->
                    maha = Graha.Jupiter
                    && (antar = Graha.Jupiter || antar = Graha.Sun))
            Reading =
                fun _ _ antar a0 a1 ->
                    sprintf
                        "Ascent of rank and dharma, ages %.1f to %.1f: a Deep Fate line over an elevated Guru mount (Samudrika) meets the Guru maha-dasha with the %s antar-dasha (Parashara). Authority, counsel and standing rise in this exact window; the gain is earned through duty, not chance."
                        a0 a1 (grahaName antar) }

          // -- Chained Heart line × Shani/Shukra interchange -------------
          { Id = RuleId.SaturnVenusRelationalStrain
            StructuralGate = allOf [ lineIs PrimaryLine.HeartLine LineState.Chained ]
            TemporalGate =
                dashaOnly (fun maha antar ->
                    (maha = Graha.Saturn && antar = Graha.Venus)
                    || (maha = Graha.Venus && antar = Graha.Saturn))
            Reading =
                fun _ maha antar a0 a1 ->
                    sprintf
                        "Relational strain, ages %.1f to %.1f: the Heart line is Chained (Samudrika) while %s and %s interlock as maha- and antar-lords (Parashara). Bonds formed or tested in this exact span carry delay and obligation; commitments demand deliberate patience."
                        a0 a1 (grahaName maha) (grahaName antar) }

          // -- Matsya/Padma/Shankha mark × benefic lord in own antar -----
          { Id = RuleId.LakshmiProsperityWindow
            StructuralGate =
                fun m ->
                    markingOn
                        [ AuspiciousMarking.Fish; AuspiciousMarking.Lotus; AuspiciousMarking.Conch ]
                        [ MountName.Jupiter; MountName.Sun ]
                        m
                    |> Option.map (fun markWitness ->
                        // An elevated mount at the marking site strengthens the
                        // verdict to a three-system alignment when present.
                        let mountSupport =
                            [ mountIs MountName.Jupiter MountProminence.High m
                              mountIs MountName.Sun MountProminence.High m ]
                            |> List.choose id
                        markWitness :: mountSupport)
            TemporalGate =
                dashaOnly (fun maha antar ->
                    (maha = Graha.Venus || maha = Graha.Jupiter) && antar = maha)
            Reading =
                fun _ maha _ a0 a1 ->
                    sprintf
                        "Prosperity window, ages %.1f to %.1f: an auspicious mark of the Samudrika canon stands on a solar/jovian mount while %s rules both maha- and antar-dasha (Parashara). Wealth and recognition consolidate in exactly this span; what is begun here compounds."
                        a0 a1 (grahaName maha) }

          // -- Forked Head line × high Budha mount × Budha dasha ---------
          { Id = RuleId.BuddhiCommerceWindow
            StructuralGate =
                allOf
                    [ lineIs PrimaryLine.HeadLine LineState.Forked
                      mountIs MountName.Mercury MountProminence.High ]
            TemporalGate =
                dashaOnly (fun maha antar ->
                    maha = Graha.Mercury
                    && (antar = Graha.Mercury || antar = Graha.Venus))
            Reading =
                fun _ _ antar a0 a1 ->
                    sprintf
                        "Intellect and commerce peak, ages %.1f to %.1f: a Forked Head line over an elevated Budha mount (Samudrika) meets the Budha maha-dasha with the %s antar-dasha (Parashara). Trade, writing and negotiation succeed in this exact span; scattered ventures outside it do not carry the same sanction."
                        a0 a1 (grahaName antar) }

          // -- Deep Life line × high Surya mount × Surya dasha -----------
          { Id = RuleId.SuryaVitalityWindow
            StructuralGate =
                allOf
                    [ lineIs PrimaryLine.LifeLine LineState.Deep
                      mountIs MountName.Sun MountProminence.High ]
            TemporalGate =
                dashaOnly (fun maha antar ->
                    maha = Graha.Sun
                    && (antar = Graha.Sun || antar = Graha.Moon || antar = Graha.Jupiter))
            Reading =
                fun _ _ antar a0 a1 ->
                    sprintf
                        "Vitality and sovereignty window, ages %.1f to %.1f: a Deep Life line beneath an elevated Surya mount (Samudrika) meets the Surya maha-dasha with the %s antar-dasha (Parashara). Health, confidence and visible leadership crest together in exactly this span."
                        a0 a1 (grahaName antar) }
        ]

    /// The Zero-Bluffing floor: fewer than two aligned systems, no event.
    let minimumAlignedSystems = 2

    let private systemOf witness =
        match witness with
        | LineWitness _
        | MountWitness _ -> KnowledgeSystem.SamudrikaPalm
        | MarkingWitness _ -> KnowledgeSystem.SamudrikaDeha
        | DashaWitness _ -> KnowledgeSystem.ParasharaDasha
        | LagnaWitness _ -> KnowledgeSystem.ParasharaLagna

    /// Runs every rule against every (maha, antar) window of the timeline.
    /// Purely a fold over immutable data: same inputs, same events, always.
    let run
        (evaluationInstant: DateTime)
        (metrics: UserMetrics)
        (ctx: DashaContext)
        (timeline: MahaDasha list)
        : TimelineEvent list =
        let birth = metrics.BirthData.UtcBirthInstant
        [ for rule in rules do
            match rule.StructuralGate metrics with
            | None -> ()
            | Some structuralWitnesses ->
                for maha in timeline do
                    for antar in maha.Antars do
                        match rule.TemporalGate ctx maha.MahaLord antar.AntarLord with
                        | None -> ()
                        | Some temporalWitnesses ->
                            let witnesses = temporalWitnesses @ structuralWitnesses
                            let systems = witnesses |> List.map systemOf |> List.distinct
                            if List.length systems >= minimumAlignedSystems then
                                let a0 = Vimshottari.ageInYearsAt birth antar.AntarPeriod.RangeStart
                                let a1 = Vimshottari.ageInYearsAt birth antar.AntarPeriod.RangeEnd
                                yield
                                    { EventType =
                                        if antar.AntarPeriod.RangeEnd <= evaluationInstant then
                                            TimelineType.PastVerification
                                        else
                                            TimelineType.FuturePrediction
                                      RuleId = rule.Id
                                      Period = antar.AntarPeriod
                                      PeakFocus =
                                        antar.Pratyantars
                                        |> List.tryHead
                                        |> Option.map (fun p -> p.PratyantarPeriod)
                                      AgeSpan = (a0, a1)
                                      Witnesses = witnesses
                                      SystemsAligned = systems
                                      StructuralReading =
                                        rule.Reading ctx maha.MahaLord antar.AntarLord a0 a1
                                      Sources =
                                        ClassicalSources.references
                                        |> Map.tryFind rule.Id
                                        |> Option.defaultValue [] } ]
