
import { Record, Union } from "../fable-library/Types.js";
import { list_type, record_type, float64_type, union_type } from "../fable-library/Reflection.js";
import { Graha, Graha_$reflection } from "./VimshottariDasha.js";
import { Astronomy_julianDay, Astronomy_lahiriAyanamsa, Astronomy_normalizeDegrees } from "./Astronomy.js";
import { min } from "../fable-library/Double.js";
import { findIndex, item } from "../fable-library/Array.js";
import { safeHash, equals } from "../fable-library/Util.js";
import { List_distinct } from "../fable-library/Seq2.js";
import { ofArray } from "../fable-library/List.js";

/**
 * The twelve rashis in canonical order from 0° sidereal Aries.
 */
export class Rashi extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena"];
    }
}

export function Rashi_$reflection() {
    return union_type("Bhavishyawani.Rashi", [], Rashi, () => [[], [], [], [], [], [], [], [], [], [], [], []]);
}

/**
 * The ascendant fixed on the rashi wheel, with an explicit measure of how
 * far it sits from the nearest sign boundary — the confidence gate for any
 * lordship-based reasoning.
 */
export class LagnaPosition extends Record {
    constructor(Rashi, SiderealLongitude, DistanceToRashiBoundary) {
        super();
        this.Rashi = Rashi;
        this.SiderealLongitude = SiderealLongitude;
        this.DistanceToRashiBoundary = DistanceToRashiBoundary;
    }
}

export function LagnaPosition_$reflection() {
    return record_type("Bhavishyawani.LagnaPosition", [], LagnaPosition, () => [["Rashi", Rashi_$reflection()], ["SiderealLongitude", float64_type], ["DistanceToRashiBoundary", float64_type]]);
}

/**
 * How the engine settled the maraka set for the chart. The basis is carried
 * on the verdict so no reading ever hides which rule produced it.
 */
export class MarakaDetermination extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["ExactFromLagna", "NaturalFallback"];
    }
}

export function MarakaDetermination_$reflection() {
    return union_type("Bhavishyawani.MarakaDetermination", [], MarakaDetermination, () => [[["lagna", Rashi_$reflection()], ["lords", list_type(Graha_$reflection())]], [["siderealAscendant", float64_type], ["toleranceDegrees", float64_type]]]);
}

export const Lagna_allRashis = [new Rashi(0, []), new Rashi(1, []), new Rashi(2, []), new Rashi(3, []), new Rashi(4, []), new Rashi(5, []), new Rashi(6, []), new Rashi(7, []), new Rashi(8, []), new Rashi(9, []), new Rashi(10, []), new Rashi(11, [])];

export function Lagna_rashiName(r) {
    switch (r.tag) {
        case 1:
            return "Vrishabha (Taurus)";
        case 2:
            return "Mithuna (Gemini)";
        case 3:
            return "Karka (Cancer)";
        case 4:
            return "Simha (Leo)";
        case 5:
            return "Kanya (Virgo)";
        case 6:
            return "Tula (Libra)";
        case 7:
            return "Vrishchika (Scorpio)";
        case 8:
            return "Dhanu (Sagittarius)";
        case 9:
            return "Makara (Capricorn)";
        case 10:
            return "Kumbha (Aquarius)";
        case 11:
            return "Meena (Pisces)";
        default:
            return "Mesha (Aries)";
    }
}

/**
 * Classical sign lordships (BPHS; the nodes own no rashi).
 */
export function Lagna_rashiLord(r) {
    switch (r.tag) {
        case 1:
            return new Graha(1, []);
        case 2:
            return new Graha(8, []);
        case 3:
            return new Graha(3, []);
        case 4:
            return new Graha(2, []);
        case 5:
            return new Graha(8, []);
        case 6:
            return new Graha(1, []);
        case 7:
            return new Graha(4, []);
        case 8:
            return new Graha(6, []);
        case 9:
            return new Graha(7, []);
        case 10:
            return new Graha(7, []);
        case 11:
            return new Graha(6, []);
        default:
            return new Graha(4, []);
    }
}

function Lagna_deg2rad(d) {
    return (d * 3.141592653589793) / 180;
}

function Lagna_rad2deg(r) {
    return (r * 180) / 3.141592653589793;
}

/**
 * Greenwich mean sidereal time as an angle in degrees (Meeus ch. 12).
 */
export function Lagna_gmstDegrees(jd) {
    const t = (jd - 2451545) / 36525;
    return Astronomy_normalizeDegrees(((280.46061837 + (360.98564736629 * (jd - 2451545))) + ((0.000387933 * t) * t)) - (((t * t) * t) / 38710000));
}

/**
 * Mean obliquity of the ecliptic, degrees (linear term of the IAU model;
 * error < 0.01° for 1800–2200).
 */
export function Lagna_meanObliquity(jd) {
    return 23.4392911 - (0.0130042 * ((jd - 2451545) / 36525));
}

/**
 * TROPICAL longitude of the ascendant, degrees [0, 360).
 * θ is the right ascension of the midheaven (local sidereal angle):
 * λ_asc = atan2( cos θ, −(sin θ·cos ε + tan φ·sin ε) )
 * Undefined behaviour inside the polar circles is excluded upstream by
 * Engine validation (PolarLatitudeUnsupported).
 */
export function Lagna_tropicalAscendant(jd, coords) {
    const theta = Lagna_deg2rad(Astronomy_normalizeDegrees(Lagna_gmstDegrees(jd) + coords.Longitude));
    const eps = Lagna_deg2rad(Lagna_meanObliquity(jd));
    const phi = Lagna_deg2rad(coords.Latitude);
    const y = Math.cos(theta);
    const x = -((Math.sin(theta) * Math.cos(eps)) + (Math.tan(phi) * Math.sin(eps)));
    return Astronomy_normalizeDegrees(Lagna_rad2deg(Math.atan2(y, x)));
}

/**
 * Sidereal (Lahiri) longitude of the ascendant, degrees [0, 360).
 */
export function Lagna_siderealAscendant(jd, coords) {
    return Astronomy_normalizeDegrees(Lagna_tropicalAscendant(jd, coords) - Astronomy_lahiriAyanamsa(jd));
}

/**
 * Fixes the lagna on the rashi wheel for a UTC birth instant and place.
 */
export function Lagna_lagnaAt(utc, coords) {
    const lon = Lagna_siderealAscendant(Astronomy_julianDay(utc), coords);
    const index = min(~~(lon / 30), 11) | 0;
    const traversed = lon - (index * 30);
    return new LagnaPosition(item(index, Lagna_allRashis), lon, min(traversed, 30 - traversed));
}

/**
 * BPHS ch. 44: the marakas are the lords of the 2nd and 7th houses,
 * counted whole-sign from the lagna (the classical jyotisha house
 * convention). Within the boundary tolerance the exact lords are
 * withheld — a wrong rashi call would name the wrong grahas entirely.
 */
export function Lagna_determineMarakas(toleranceDegrees, lagna) {
    if (lagna.DistanceToRashiBoundary < toleranceDegrees) {
        return new MarakaDetermination(1, [lagna.SiderealLongitude, toleranceDegrees]);
    }
    else {
        const baseIndex = findIndex((y) => equals(lagna.Rashi, y), Lagna_allRashis) | 0;
        const houseLord = (offsetFromLagna) => Lagna_rashiLord(item((baseIndex + offsetFromLagna) % 12, Lagna_allRashis));
        return new MarakaDetermination(0, [lagna.Rashi, List_distinct(ofArray([houseLord(1), houseLord(6)]), {
            Equals: equals,
            GetHashCode: (x_1) => (safeHash(x_1) | 0),
        })]);
    }
}

