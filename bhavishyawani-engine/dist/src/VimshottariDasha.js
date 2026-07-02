
import { Record, Union } from "../fable-library/Types.js";
import { list_type, record_type, union_type } from "../fable-library/Reflection.js";
import { DateRange, DateRange_$reflection } from "./Domain.js";
import { fold, initialize, findIndex, item } from "../fable-library/Array.js";
import { equals } from "../fable-library/Util.js";
import { Astronomy_nakshatraSpanDegrees, Astronomy_allNakshatras } from "./Astronomy.js";
import { choose, empty, cons, reverse } from "../fable-library/List.js";
import { compare, op_Subtraction, addDays } from "../fable-library/Date.js";
import { totalDays as totalDays_1 } from "../fable-library/TimeSpan.js";
import { map } from "../fable-library/Option.js";

/**
 * The nine dasha lords (grahas) of the Vimshottari scheme.
 */
export class Graha extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
    }
}

export function Graha_$reflection() {
    return union_type("Bhavishyawani.Graha", [], Graha, () => [[], [], [], [], [], [], [], [], []]);
}

/**
 * Sub-sub-period. The finest structural granule this engine emits.
 */
export class PratyantarDasha extends Record {
    constructor(PratyantarLord, PratyantarPeriod) {
        super();
        this.PratyantarLord = PratyantarLord;
        this.PratyantarPeriod = PratyantarPeriod;
    }
}

export function PratyantarDasha_$reflection() {
    return record_type("Bhavishyawani.PratyantarDasha", [], PratyantarDasha, () => [["PratyantarLord", Graha_$reflection()], ["PratyantarPeriod", DateRange_$reflection()]]);
}

/**
 * Sub-period, carrying its full pratyantar subdivision.
 */
export class AntarDasha extends Record {
    constructor(AntarLord, AntarPeriod, Pratyantars) {
        super();
        this.AntarLord = AntarLord;
        this.AntarPeriod = AntarPeriod;
        this.Pratyantars = Pratyantars;
    }
}

export function AntarDasha_$reflection() {
    return record_type("Bhavishyawani.AntarDasha", [], AntarDasha, () => [["AntarLord", Graha_$reflection()], ["AntarPeriod", DateRange_$reflection()], ["Pratyantars", list_type(PratyantarDasha_$reflection())]]);
}

/**
 * Major period, carrying its full antar subdivision.
 */
export class MahaDasha extends Record {
    constructor(MahaLord, MahaPeriod, Antars) {
        super();
        this.MahaLord = MahaLord;
        this.MahaPeriod = MahaPeriod;
        this.Antars = Antars;
    }
}

export function MahaDasha_$reflection() {
    return record_type("Bhavishyawani.MahaDasha", [], MahaDasha, () => [["MahaLord", Graha_$reflection()], ["MahaPeriod", DateRange_$reflection()], ["Antars", list_type(AntarDasha_$reflection())]]);
}

/**
 * BPHS allotment of years per lord (sums to exactly 120).
 */
export function Vimshottari_dashaYears(g) {
    switch (g.tag) {
        case 1:
            return 20;
        case 2:
            return 6;
        case 3:
            return 10;
        case 4:
            return 7;
        case 5:
            return 18;
        case 6:
            return 16;
        case 7:
            return 19;
        case 8:
            return 17;
        default:
            return 7;
    }
}

export const Vimshottari_lordCycle = [new Graha(0, []), new Graha(1, []), new Graha(2, []), new Graha(3, []), new Graha(4, []), new Graha(5, []), new Graha(6, []), new Graha(7, []), new Graha(8, [])];

export function Vimshottari_grahaName(g) {
    switch (g.tag) {
        case 1:
            return "Shukra (Venus)";
        case 2:
            return "Surya (Sun)";
        case 3:
            return "Chandra (Moon)";
        case 4:
            return "Mangala (Mars)";
        case 5:
            return "Rahu (North Node)";
        case 6:
            return "Guru (Jupiter)";
        case 7:
            return "Shani (Saturn)";
        case 8:
            return "Budha (Mercury)";
        default:
            return "Ketu (South Node)";
    }
}

/**
 * The opening dasha lord of a nakshatra: the 27 nakshatras map onto the
 * 9-lord cycle three times over (nakshatra index mod 9).
 */
export function Vimshottari_nakshatraLord(n) {
    return item(findIndex((y) => equals(n, y), Astronomy_allNakshatras) % 9, Vimshottari_lordCycle);
}

function Vimshottari_cycleFrom(start) {
    const i = findIndex((y) => equals(start, y), Vimshottari_lordCycle) | 0;
    return initialize(9, (k) => item((i + k) % 9, Vimshottari_lordCycle));
}

function Vimshottari_subdivide(startLord, rangeStart, totalDays) {
    return reverse(fold((tupledArg, lord) => {
        const cursor = tupledArg[0];
        const finish = addDays(cursor, (totalDays * Vimshottari_dashaYears(lord)) / 120);
        return [finish, cons([lord, new DateRange(cursor, finish)], tupledArg[1])];
    }, [rangeStart, empty()], Vimshottari_cycleFrom(startLord))[1]);
}

/**
 * Age of the native at an instant, in mean solar years.
 */
export function Vimshottari_ageInYearsAt(birth, instant) {
    return totalDays_1(op_Subtraction(instant, birth)) / 365.25;
}

/**
 * Builds the full 120-year Maha → Antar → Pratyantar tree.
 * 
 * The dasha balance at birth is fixed by the fraction of the natal
 * nakshatra the Moon has already traversed (BPHS): the first maha-dasha
 * notionally began before birth, so the tree is generated from that
 * virtual anchor and then clipped at the birth instant. Sub-periods that
 * ended before birth are removed; the one in progress is truncated.
 */
export function Vimshottari_buildTimeline(birth, moon) {
    const firstLord = Vimshottari_nakshatraLord(moon.Nakshatra);
    const clip = (r) => {
        if (compare(r.RangeEnd, birth) <= 0) {
            return undefined;
        }
        else if (compare(r.RangeStart, birth) < 0) {
            return new DateRange(birth, r.RangeEnd);
        }
        else {
            return r;
        }
    };
    return choose((tupledArg) => {
        const mahaLord = tupledArg[0];
        const mahaFull = tupledArg[1];
        return map((mahaClipped) => (new MahaDasha(mahaLord, mahaClipped, choose((tupledArg_1) => {
            const antarLord = tupledArg_1[0];
            const antarFull = tupledArg_1[1];
            return map((antarClipped) => (new AntarDasha(antarLord, antarClipped, choose((tupledArg_2) => map((pClipped) => (new PratyantarDasha(tupledArg_2[0], pClipped)), clip(tupledArg_2[1])), Vimshottari_subdivide(antarLord, antarFull.RangeStart, totalDays_1(op_Subtraction(antarFull.RangeEnd, antarFull.RangeStart)))))), clip(antarFull));
        }, Vimshottari_subdivide(mahaLord, mahaFull.RangeStart, totalDays_1(op_Subtraction(mahaFull.RangeEnd, mahaFull.RangeStart)))))), clip(mahaFull));
    }, Vimshottari_subdivide(firstLord, addDays(birth, -((moon.DegreesTraversed / Astronomy_nakshatraSpanDegrees) * (Vimshottari_dashaYears(firstLord) * 365.25))), 120 * 365.25));
}

