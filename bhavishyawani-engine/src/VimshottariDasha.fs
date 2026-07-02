namespace Bhavishyawani

open System

// =============================================================================
// 2. DETERMINISTIC CHRONOLOGY — Vimshottari Dasha
//
// Brihat Parashara Hora Shastra, Dasha-adhyayas: a 120-year planetary clock
// whose opening balance is fixed purely by the natal Moon's degree inside its
// nakshatra. Given the same birth instant, this module always produces the
// same Maha → Antar → Pratyantar tree, mapped to exact civil dates.
// =============================================================================

/// The nine dasha lords (grahas) of the Vimshottari scheme.
[<RequireQualifiedAccess>]
type Graha =
    | Ketu
    | Venus
    | Sun
    | Moon
    | Mars
    | Rahu
    | Jupiter
    | Saturn
    | Mercury

/// Sub-sub-period. The finest structural granule this engine emits.
type PratyantarDasha =
    { PratyantarLord: Graha
      PratyantarPeriod: DateRange }

/// Sub-period, carrying its full pratyantar subdivision.
type AntarDasha =
    { AntarLord: Graha
      AntarPeriod: DateRange
      Pratyantars: PratyantarDasha list }

/// Major period, carrying its full antar subdivision.
type MahaDasha =
    { MahaLord: Graha
      MahaPeriod: DateRange
      Antars: AntarDasha list }

module Vimshottari =

    /// BPHS: the full Vimshottari span is 120 years.
    [<Literal>]
    let TotalYears = 120.0

    /// Mean solar year of 365.25 days — the convention of the standard
    /// Lahiri dasha tables. Stated here once so the choice is auditable.
    [<Literal>]
    let DaysPerYear = 365.25

    /// BPHS allotment of years per lord (sums to exactly 120).
    let dashaYears (g: Graha) =
        match g with
        | Graha.Ketu -> 7.0
        | Graha.Venus -> 20.0
        | Graha.Sun -> 6.0
        | Graha.Moon -> 10.0
        | Graha.Mars -> 7.0
        | Graha.Rahu -> 18.0
        | Graha.Jupiter -> 16.0
        | Graha.Saturn -> 19.0
        | Graha.Mercury -> 17.0

    /// Canonical lord order, anchored at Ashwini.
    let lordCycle =
        [| Graha.Ketu
           Graha.Venus
           Graha.Sun
           Graha.Moon
           Graha.Mars
           Graha.Rahu
           Graha.Jupiter
           Graha.Saturn
           Graha.Mercury |]

    let grahaName (g: Graha) =
        match g with
        | Graha.Ketu -> "Ketu (South Node)"
        | Graha.Venus -> "Shukra (Venus)"
        | Graha.Sun -> "Surya (Sun)"
        | Graha.Moon -> "Chandra (Moon)"
        | Graha.Mars -> "Mangala (Mars)"
        | Graha.Rahu -> "Rahu (North Node)"
        | Graha.Jupiter -> "Guru (Jupiter)"
        | Graha.Saturn -> "Shani (Saturn)"
        | Graha.Mercury -> "Budha (Mercury)"

    /// The opening dasha lord of a nakshatra: the 27 nakshatras map onto the
    /// 9-lord cycle three times over (nakshatra index mod 9).
    let nakshatraLord (n: Nakshatra) =
        let idx = Array.findIndex ((=) n) Astronomy.allNakshatras
        lordCycle.[idx % 9]

    let private cycleFrom (start: Graha) =
        let i = Array.findIndex ((=) start) lordCycle
        Array.init 9 (fun k -> lordCycle.[(i + k) % 9])

    /// Splits [rangeStart, rangeStart + totalDays) into nine consecutive
    /// sub-periods proportioned as dashaYears(lord) / 120, starting from
    /// `startLord`. This one proportional law generates every level of the
    /// tree (maha, antar, pratyantar) — exactly as BPHS prescribes.
    let private subdivide (startLord: Graha) (rangeStart: DateTime) (totalDays: float) =
        cycleFrom startLord
        |> Array.fold
            (fun (cursor: DateTime, acc) lord ->
                let span = totalDays * dashaYears lord / TotalYears
                let finish = cursor.AddDays span
                finish, (lord, { RangeStart = cursor; RangeEnd = finish }) :: acc)
            (rangeStart, [])
        |> snd
        |> List.rev

    /// Age of the native at an instant, in mean solar years.
    let ageInYearsAt (birth: DateTime) (instant: DateTime) =
        (instant - birth).TotalDays / DaysPerYear

    /// Builds the full 120-year Maha → Antar → Pratyantar tree.
    ///
    /// The dasha balance at birth is fixed by the fraction of the natal
    /// nakshatra the Moon has already traversed (BPHS): the first maha-dasha
    /// notionally began before birth, so the tree is generated from that
    /// virtual anchor and then clipped at the birth instant. Sub-periods that
    /// ended before birth are removed; the one in progress is truncated.
    let buildTimeline (birth: DateTime) (moon: MoonNakshatraPosition) : MahaDasha list =
        let firstLord = nakshatraLord moon.Nakshatra
        let elapsedFraction = moon.DegreesTraversed / Astronomy.nakshatraSpanDegrees
        let firstMahaDays = dashaYears firstLord * DaysPerYear
        let virtualStart = birth.AddDays(-(elapsedFraction * firstMahaDays))

        let clip (r: DateRange) : DateRange option =
            if r.RangeEnd <= birth then None
            elif r.RangeStart < birth then Some { r with RangeStart = birth }
            else Some r

        subdivide firstLord virtualStart (TotalYears * DaysPerYear)
        |> List.choose (fun (mahaLord, mahaFull) ->
            clip mahaFull
            |> Option.map (fun mahaClipped ->
                let mahaDays = (mahaFull.RangeEnd - mahaFull.RangeStart).TotalDays
                let antars =
                    subdivide mahaLord mahaFull.RangeStart mahaDays
                    |> List.choose (fun (antarLord, antarFull) ->
                        clip antarFull
                        |> Option.map (fun antarClipped ->
                            let antarDays = (antarFull.RangeEnd - antarFull.RangeStart).TotalDays
                            let pratyantars =
                                subdivide antarLord antarFull.RangeStart antarDays
                                |> List.choose (fun (pLord, pFull) ->
                                    clip pFull
                                    |> Option.map (fun pClipped ->
                                        { PratyantarLord = pLord
                                          PratyantarPeriod = pClipped }))
                            { AntarLord = antarLord
                              AntarPeriod = antarClipped
                              Pratyantars = pratyantars }))
                { MahaLord = mahaLord
                  MahaPeriod = mahaClipped
                  Antars = antars }))
