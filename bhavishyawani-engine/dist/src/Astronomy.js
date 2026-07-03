
import { Record, Union } from "../fable-library/Types.js";
import { record_type, float64_type, union_type } from "../fable-library/Reflection.js";
import { day, millisecond, second, minute, hour, year, month } from "../fable-library/Date.js";
import { min } from "../fable-library/Double.js";
import { item } from "../fable-library/Array.js";

/**
 * The 27 nakshatras in canonical order from 0° sidereal Aries.
 */
export class Nakshatra extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "PurvaPhalguni", "UttaraPhalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "PurvaAshadha", "UttaraAshadha", "Shravana", "Dhanishta", "Shatabhisha", "PurvaBhadrapada", "UttaraBhadrapada", "Revati"];
    }
}

export function Nakshatra_$reflection() {
    return union_type("Bhavishyawani.Nakshatra", [], Nakshatra, () => [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []]);
}

/**
 * The natal Moon fixed against the nakshatra wheel, with an explicit measure
 * of how far it sits from the nearest boundary — the engine's confidence gate.
 */
export class MoonNakshatraPosition extends Record {
    constructor(Nakshatra, SiderealLongitude, DegreesTraversed, DistanceToNearestBoundary) {
        super();
        this.Nakshatra = Nakshatra;
        this.SiderealLongitude = SiderealLongitude;
        this.DegreesTraversed = DegreesTraversed;
        this.DistanceToNearestBoundary = DistanceToNearestBoundary;
    }
}

export function MoonNakshatraPosition_$reflection() {
    return record_type("Bhavishyawani.MoonNakshatraPosition", [], MoonNakshatraPosition, () => [["Nakshatra", Nakshatra_$reflection()], ["SiderealLongitude", float64_type], ["DegreesTraversed", float64_type], ["DistanceToNearestBoundary", float64_type]]);
}

export const Astronomy_nakshatraSpanDegrees = 360 / 27;

export const Astronomy_allNakshatras = [new Nakshatra(0, []), new Nakshatra(1, []), new Nakshatra(2, []), new Nakshatra(3, []), new Nakshatra(4, []), new Nakshatra(5, []), new Nakshatra(6, []), new Nakshatra(7, []), new Nakshatra(8, []), new Nakshatra(9, []), new Nakshatra(10, []), new Nakshatra(11, []), new Nakshatra(12, []), new Nakshatra(13, []), new Nakshatra(14, []), new Nakshatra(15, []), new Nakshatra(16, []), new Nakshatra(17, []), new Nakshatra(18, []), new Nakshatra(19, []), new Nakshatra(20, []), new Nakshatra(21, []), new Nakshatra(22, []), new Nakshatra(23, []), new Nakshatra(24, []), new Nakshatra(25, []), new Nakshatra(26, [])];

export function Astronomy_nakshatraName(n) {
    switch (n.tag) {
        case 1:
            return "Bharani";
        case 2:
            return "Krittika";
        case 3:
            return "Rohini";
        case 4:
            return "Mrigashira";
        case 5:
            return "Ardra";
        case 6:
            return "Punarvasu";
        case 7:
            return "Pushya";
        case 8:
            return "Ashlesha";
        case 9:
            return "Magha";
        case 10:
            return "Purva Phalguni";
        case 11:
            return "Uttara Phalguni";
        case 12:
            return "Hasta";
        case 13:
            return "Chitra";
        case 14:
            return "Swati";
        case 15:
            return "Vishakha";
        case 16:
            return "Anuradha";
        case 17:
            return "Jyeshtha";
        case 18:
            return "Mula";
        case 19:
            return "Purva Ashadha";
        case 20:
            return "Uttara Ashadha";
        case 21:
            return "Shravana";
        case 22:
            return "Dhanishta";
        case 23:
            return "Shatabhisha";
        case 24:
            return "Purva Bhadrapada";
        case 25:
            return "Uttara Bhadrapada";
        case 26:
            return "Revati";
        default:
            return "Ashwini";
    }
}

function Astronomy_deg2rad(d) {
    return (d * 3.141592653589793) / 180;
}

export function Astronomy_normalizeDegrees(d) {
    const r = d % 360;
    if (r < 0) {
        return r + 360;
    }
    else {
        return r;
    }
}

/**
 * Julian Day for a UTC instant (Meeus ch. 7, Gregorian calendar).
 */
export function Astronomy_julianDay(utc) {
    const patternInput = (month(utc) <= 2) ? [year(utc) - 1, month(utc) + 12] : [year(utc), month(utc)];
    const y = patternInput[0] | 0;
    const a = ~~(y / 100) | 0;
    const b = ((2 - a) + ~~(a / 4)) | 0;
    const dayFraction = ((hour(utc) + (minute(utc) / 60)) + ((second(utc) + (millisecond(utc) / 1000)) / 3600)) / 24;
    return ((((Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (patternInput[1] + 1))) + day(utc)) + dayFraction) + b) - 1524.5;
}

/**
 * Geocentric TROPICAL ecliptic longitude of the Moon, degrees.
 * Classical jyotisha computes the Moon geocentrically; the birth
 * coordinates are reserved for lagna work, not used here.
 */
export function Astronomy_tropicalMoonLongitude(jd) {
    const t = (jd - 2451545) / 36525;
    const lp = Astronomy_normalizeDegrees(218.3164477 + (481267.88123421 * t));
    const d = Astronomy_normalizeDegrees(297.8501921 + (445267.1114034 * t));
    const m = Astronomy_normalizeDegrees(357.5291092 + (35999.0502909 * t));
    const mp = Astronomy_normalizeDegrees(134.9633964 + (477198.8675055 * t));
    const f = Astronomy_normalizeDegrees(93.272095 + (483202.0175233 * t));
    const s = (x) => Math.sin(Astronomy_deg2rad(x));
    return Astronomy_normalizeDegrees((((((lp + (6.288774 * s(mp))) + (1.274027 * s((2 * d) - mp))) + (0.658314 * s(2 * d))) + (0.213618 * s(2 * mp))) - (0.185116 * s(m))) - (0.114332 * s(2 * f)));
}

/**
 * Lahiri (Chitrapaksha) ayanamsa, degrees. Linear model: 23°51'11" at
 * J2000 advancing at the mean precession rate of 50.2888"/year.
 */
export function Astronomy_lahiriAyanamsa(jd) {
    return 23.85319 + ((50.2888 / 3600) * ((jd - 2451545) / 365.25));
}

/**
 * Sidereal (Lahiri) longitude of the Moon, degrees [0, 360).
 */
export function Astronomy_siderealMoonLongitude(jd) {
    return Astronomy_normalizeDegrees(Astronomy_tropicalMoonLongitude(jd) - Astronomy_lahiriAyanamsa(jd));
}

/**
 * Fixes the natal Moon on the nakshatra wheel for a UTC birth instant.
 */
export function Astronomy_moonNakshatraAt(utcInstant) {
    const lon = Astronomy_siderealMoonLongitude(Astronomy_julianDay(utcInstant));
    const index = min(~~(lon / Astronomy_nakshatraSpanDegrees), 26) | 0;
    const traversed = lon - (index * Astronomy_nakshatraSpanDegrees);
    return new MoonNakshatraPosition(item(index, Astronomy_allNakshatras), lon, traversed, min(traversed, Astronomy_nakshatraSpanDegrees - traversed));
}

