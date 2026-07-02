namespace Bhavishyawani

open System

// =============================================================================
// ASTRONOMICAL KERNEL
//
// Pure, closed-form astronomy — no ephemeris files, no external libraries, so
// the module compiles to plain JavaScript under Fable with no runtime deps.
//
// Precision statement (this engine never claims more than it can deliver):
//   * Lunar longitude: truncated principal-term theory (Meeus, "Astronomical
//     Algorithms", ch. 47, six largest periodic terms). Worst-case error
//     ≈ 0.30° against full ELP for 1800–2200.
//   * Lahiri ayanamsa: linear model anchored at J2000. Error < 0.05° for
//     1900–2100.
// The engine's nakshatra-boundary tolerance (see Engine.fs) is derived from
// these bounds. Inside the tolerance band the engine REFUSES to answer rather
// than silently picking a nakshatra that the mathematics cannot guarantee.
// =============================================================================

/// The 27 nakshatras in canonical order from 0° sidereal Aries.
[<RequireQualifiedAccess>]
type Nakshatra =
    | Ashwini
    | Bharani
    | Krittika
    | Rohini
    | Mrigashira
    | Ardra
    | Punarvasu
    | Pushya
    | Ashlesha
    | Magha
    | PurvaPhalguni
    | UttaraPhalguni
    | Hasta
    | Chitra
    | Swati
    | Vishakha
    | Anuradha
    | Jyeshtha
    | Mula
    | PurvaAshadha
    | UttaraAshadha
    | Shravana
    | Dhanishta
    | Shatabhisha
    | PurvaBhadrapada
    | UttaraBhadrapada
    | Revati

/// The natal Moon fixed against the nakshatra wheel, with an explicit measure
/// of how far it sits from the nearest boundary — the engine's confidence gate.
type MoonNakshatraPosition =
    { Nakshatra: Nakshatra
      /// Sidereal (Lahiri) ecliptic longitude of the Moon, degrees [0, 360).
      SiderealLongitude: float
      /// Degrees already traversed inside the nakshatra, [0, 13.3333).
      DegreesTraversed: float
      /// Angular distance to the nearest nakshatra boundary, degrees.
      DistanceToNearestBoundary: float }

module Astronomy =

    [<Literal>]
    let J2000 = 2451545.0

    /// One nakshatra spans exactly 13°20'.
    let nakshatraSpanDegrees = 360.0 / 27.0

    let allNakshatras =
        [| Nakshatra.Ashwini
           Nakshatra.Bharani
           Nakshatra.Krittika
           Nakshatra.Rohini
           Nakshatra.Mrigashira
           Nakshatra.Ardra
           Nakshatra.Punarvasu
           Nakshatra.Pushya
           Nakshatra.Ashlesha
           Nakshatra.Magha
           Nakshatra.PurvaPhalguni
           Nakshatra.UttaraPhalguni
           Nakshatra.Hasta
           Nakshatra.Chitra
           Nakshatra.Swati
           Nakshatra.Vishakha
           Nakshatra.Anuradha
           Nakshatra.Jyeshtha
           Nakshatra.Mula
           Nakshatra.PurvaAshadha
           Nakshatra.UttaraAshadha
           Nakshatra.Shravana
           Nakshatra.Dhanishta
           Nakshatra.Shatabhisha
           Nakshatra.PurvaBhadrapada
           Nakshatra.UttaraBhadrapada
           Nakshatra.Revati |]

    let nakshatraName (n: Nakshatra) =
        match n with
        | Nakshatra.Ashwini -> "Ashwini"
        | Nakshatra.Bharani -> "Bharani"
        | Nakshatra.Krittika -> "Krittika"
        | Nakshatra.Rohini -> "Rohini"
        | Nakshatra.Mrigashira -> "Mrigashira"
        | Nakshatra.Ardra -> "Ardra"
        | Nakshatra.Punarvasu -> "Punarvasu"
        | Nakshatra.Pushya -> "Pushya"
        | Nakshatra.Ashlesha -> "Ashlesha"
        | Nakshatra.Magha -> "Magha"
        | Nakshatra.PurvaPhalguni -> "Purva Phalguni"
        | Nakshatra.UttaraPhalguni -> "Uttara Phalguni"
        | Nakshatra.Hasta -> "Hasta"
        | Nakshatra.Chitra -> "Chitra"
        | Nakshatra.Swati -> "Swati"
        | Nakshatra.Vishakha -> "Vishakha"
        | Nakshatra.Anuradha -> "Anuradha"
        | Nakshatra.Jyeshtha -> "Jyeshtha"
        | Nakshatra.Mula -> "Mula"
        | Nakshatra.PurvaAshadha -> "Purva Ashadha"
        | Nakshatra.UttaraAshadha -> "Uttara Ashadha"
        | Nakshatra.Shravana -> "Shravana"
        | Nakshatra.Dhanishta -> "Dhanishta"
        | Nakshatra.Shatabhisha -> "Shatabhisha"
        | Nakshatra.PurvaBhadrapada -> "Purva Bhadrapada"
        | Nakshatra.UttaraBhadrapada -> "Uttara Bhadrapada"
        | Nakshatra.Revati -> "Revati"

    let private deg2rad d = d * Math.PI / 180.0

    let normalizeDegrees d =
        let r = d % 360.0
        if r < 0.0 then r + 360.0 else r

    /// Julian Day for a UTC instant (Meeus ch. 7, Gregorian calendar).
    let julianDay (utc: DateTime) =
        let y, m =
            if utc.Month <= 2 then utc.Year - 1, utc.Month + 12
            else utc.Year, utc.Month
        let a = y / 100
        let b = 2 - a + a / 4
        let dayFraction =
            (float utc.Hour
             + float utc.Minute / 60.0
             + (float utc.Second + float utc.Millisecond / 1000.0) / 3600.0)
            / 24.0
        floor (365.25 * float (y + 4716))
        + floor (30.6001 * float (m + 1))
        + float utc.Day
        + dayFraction
        + float b
        - 1524.5

    /// Geocentric TROPICAL ecliptic longitude of the Moon, degrees.
    /// Classical jyotisha computes the Moon geocentrically; the birth
    /// coordinates are reserved for lagna work, not used here.
    let tropicalMoonLongitude jd =
        let t = (jd - J2000) / 36525.0
        // Mean elements (degrees), Meeus ch. 47, linear terms.
        let lp = normalizeDegrees (218.3164477 + 481267.88123421 * t) // mean longitude
        let d = normalizeDegrees (297.8501921 + 445267.1114034 * t)   // mean elongation
        let m = normalizeDegrees (357.5291092 + 35999.0502909 * t)    // Sun mean anomaly
        let mp = normalizeDegrees (134.9633964 + 477198.8675055 * t)  // Moon mean anomaly
        let f = normalizeDegrees (93.2720950 + 483202.0175233 * t)    // argument of latitude
        let s x = sin (deg2rad x)
        lp
        + 6.288774 * s mp             // equation of the centre
        + 1.274027 * s (2.0 * d - mp) // evection
        + 0.658314 * s (2.0 * d)      // variation
        + 0.213618 * s (2.0 * mp)
        - 0.185116 * s m              // annual equation
        - 0.114332 * s (2.0 * f)
        |> normalizeDegrees

    /// Lahiri (Chitrapaksha) ayanamsa, degrees. Linear model: 23°51'11" at
    /// J2000 advancing at the mean precession rate of 50.2888"/year.
    let lahiriAyanamsa jd =
        23.85319 + (50.2888 / 3600.0) * ((jd - J2000) / 365.25)

    /// Sidereal (Lahiri) longitude of the Moon, degrees [0, 360).
    let siderealMoonLongitude jd =
        normalizeDegrees (tropicalMoonLongitude jd - lahiriAyanamsa jd)

    /// Fixes the natal Moon on the nakshatra wheel for a UTC birth instant.
    let moonNakshatraAt (utcInstant: DateTime) : MoonNakshatraPosition =
        let lon = siderealMoonLongitude (julianDay utcInstant)
        // min guards the pathological lon = 360.0 - epsilon rounding case.
        let index = min (int (lon / nakshatraSpanDegrees)) 26
        let traversed = lon - float index * nakshatraSpanDegrees
        { Nakshatra = allNakshatras.[index]
          SiderealLongitude = lon
          DegreesTraversed = traversed
          DistanceToNearestBoundary = min traversed (nakshatraSpanDegrees - traversed) }
