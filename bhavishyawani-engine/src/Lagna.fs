namespace Bhavishyawani

open System

// =============================================================================
// LAGNA (ASCENDANT) MODULE
//
// Consumes the birth coordinates that Domain.fs captures: local sidereal time
// from the Greenwich mean sidereal angle plus the east longitude, then the
// rising ecliptic point for the birth latitude, then Lahiri-sidereal rashi.
//
// This unlocks the true BPHS maraka determination (ch. 44): the lords of the
// 2nd and 7th houses counted whole-sign from the lagna. In keeping with the
// Zero-Bluffing policy, if the ascendant falls within the stated tolerance of
// a rashi boundary the module refuses to name exact lords and reports a
// declared fallback instead of a guess — the caller can always see which
// basis was used.
// =============================================================================

/// The twelve rashis in canonical order from 0° sidereal Aries.
[<RequireQualifiedAccess>]
type Rashi =
    | Mesha      // Aries
    | Vrishabha  // Taurus
    | Mithuna    // Gemini
    | Karka      // Cancer
    | Simha      // Leo
    | Kanya      // Virgo
    | Tula       // Libra
    | Vrishchika // Scorpio
    | Dhanu      // Sagittarius
    | Makara     // Capricorn
    | Kumbha     // Aquarius
    | Meena      // Pisces

/// The ascendant fixed on the rashi wheel, with an explicit measure of how
/// far it sits from the nearest sign boundary — the confidence gate for any
/// lordship-based reasoning.
type LagnaPosition =
    { Rashi: Rashi
      /// Sidereal (Lahiri) ecliptic longitude of the ascendant, degrees [0, 360).
      SiderealLongitude: float
      /// Angular distance to the nearest rashi boundary, degrees.
      DistanceToRashiBoundary: float }

/// How the engine settled the maraka set for the chart. The basis is carried
/// on the verdict so no reading ever hides which rule produced it.
[<RequireQualifiedAccess>]
type MarakaDetermination =
    /// Lagna resolved cleanly: the BPHS ch. 44 lords of the 2nd and 7th
    /// whole-sign houses from the lagna.
    | ExactFromLagna of lagna: Rashi * lords: Graha list
    /// The ascendant sits nearer a rashi boundary than the tolerance allows;
    /// exact lords are withheld and the natural maraka-natured grahas
    /// (Shani, Mangala) are used instead — declared, not guessed.
    | NaturalFallback of siderealAscendant: float * toleranceDegrees: float

module Lagna =

    let allRashis =
        [| Rashi.Mesha
           Rashi.Vrishabha
           Rashi.Mithuna
           Rashi.Karka
           Rashi.Simha
           Rashi.Kanya
           Rashi.Tula
           Rashi.Vrishchika
           Rashi.Dhanu
           Rashi.Makara
           Rashi.Kumbha
           Rashi.Meena |]

    let rashiName (r: Rashi) =
        match r with
        | Rashi.Mesha -> "Mesha (Aries)"
        | Rashi.Vrishabha -> "Vrishabha (Taurus)"
        | Rashi.Mithuna -> "Mithuna (Gemini)"
        | Rashi.Karka -> "Karka (Cancer)"
        | Rashi.Simha -> "Simha (Leo)"
        | Rashi.Kanya -> "Kanya (Virgo)"
        | Rashi.Tula -> "Tula (Libra)"
        | Rashi.Vrishchika -> "Vrishchika (Scorpio)"
        | Rashi.Dhanu -> "Dhanu (Sagittarius)"
        | Rashi.Makara -> "Makara (Capricorn)"
        | Rashi.Kumbha -> "Kumbha (Aquarius)"
        | Rashi.Meena -> "Meena (Pisces)"

    /// Classical sign lordships (BPHS; the nodes own no rashi).
    let rashiLord (r: Rashi) =
        match r with
        | Rashi.Mesha -> Graha.Mars
        | Rashi.Vrishabha -> Graha.Venus
        | Rashi.Mithuna -> Graha.Mercury
        | Rashi.Karka -> Graha.Moon
        | Rashi.Simha -> Graha.Sun
        | Rashi.Kanya -> Graha.Mercury
        | Rashi.Tula -> Graha.Venus
        | Rashi.Vrishchika -> Graha.Mars
        | Rashi.Dhanu -> Graha.Jupiter
        | Rashi.Makara -> Graha.Saturn
        | Rashi.Kumbha -> Graha.Saturn
        | Rashi.Meena -> Graha.Jupiter

    let private deg2rad d = d * Math.PI / 180.0
    let private rad2deg r = r * 180.0 / Math.PI

    /// Greenwich mean sidereal time as an angle in degrees (Meeus ch. 12).
    let gmstDegrees jd =
        let t = (jd - Astronomy.J2000) / 36525.0
        Astronomy.normalizeDegrees
            (280.46061837
             + 360.98564736629 * (jd - Astronomy.J2000)
             + 0.000387933 * t * t
             - t * t * t / 38710000.0)

    /// Mean obliquity of the ecliptic, degrees (linear term of the IAU model;
    /// error < 0.01° for 1800–2200).
    let meanObliquity jd =
        let t = (jd - Astronomy.J2000) / 36525.0
        23.4392911 - 0.0130042 * t

    /// TROPICAL longitude of the ascendant, degrees [0, 360).
    /// θ is the right ascension of the midheaven (local sidereal angle):
    ///   λ_asc = atan2( cos θ, −(sin θ·cos ε + tan φ·sin ε) )
    /// Undefined behaviour inside the polar circles is excluded upstream by
    /// Engine validation (PolarLatitudeUnsupported).
    let tropicalAscendant jd (coords: GeoCoordinates) =
        let theta = deg2rad (Astronomy.normalizeDegrees (gmstDegrees jd + coords.Longitude))
        let eps = deg2rad (meanObliquity jd)
        let phi = deg2rad coords.Latitude
        let y = cos theta
        let x = -(sin theta * cos eps + tan phi * sin eps)
        Astronomy.normalizeDegrees (rad2deg (atan2 y x))

    /// Sidereal (Lahiri) longitude of the ascendant, degrees [0, 360).
    let siderealAscendant jd coords =
        Astronomy.normalizeDegrees (tropicalAscendant jd coords - Astronomy.lahiriAyanamsa jd)

    /// Fixes the lagna on the rashi wheel for a UTC birth instant and place.
    let lagnaAt (utc: DateTime) (coords: GeoCoordinates) : LagnaPosition =
        let lon = siderealAscendant (Astronomy.julianDay utc) coords
        // min guards the pathological lon = 360.0 - epsilon rounding case.
        let index = min (int (lon / 30.0)) 11
        let traversed = lon - float index * 30.0
        { Rashi = allRashis.[index]
          SiderealLongitude = lon
          DistanceToRashiBoundary = min traversed (30.0 - traversed) }

    /// BPHS ch. 44: the marakas are the lords of the 2nd and 7th houses,
    /// counted whole-sign from the lagna (the classical jyotisha house
    /// convention). Within the boundary tolerance the exact lords are
    /// withheld — a wrong rashi call would name the wrong grahas entirely.
    let determineMarakas (toleranceDegrees: float) (lagna: LagnaPosition) : MarakaDetermination =
        if lagna.DistanceToRashiBoundary < toleranceDegrees then
            MarakaDetermination.NaturalFallback(lagna.SiderealLongitude, toleranceDegrees)
        else
            let baseIndex = Array.findIndex ((=) lagna.Rashi) allRashis
            let houseLord offsetFromLagna =
                rashiLord allRashis.[(baseIndex + offsetFromLagna) % 12]
            let lords = [ houseLord 1; houseLord 6 ] |> List.distinct // 2nd, 7th
            MarakaDetermination.ExactFromLagna(lagna.Rashi, lords)
