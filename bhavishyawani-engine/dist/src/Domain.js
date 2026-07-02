
import { Union, Record } from "../fable-library/Types.js";
import { option_type, list_type, union_type, class_type, record_type, float64_type } from "../fable-library/Reflection.js";

/**
 * Geographic coordinates of the birth place, WGS84 decimal degrees.
 */
export class GeoCoordinates extends Record {
    constructor(Latitude, Longitude) {
        super();
        this.Latitude = Latitude;
        this.Longitude = Longitude;
    }
}

export function GeoCoordinates_$reflection() {
    return record_type("Bhavishyawani.GeoCoordinates", [], GeoCoordinates, () => [["Latitude", float64_type], ["Longitude", float64_type]]);
}

/**
 * The exact birth instant. The caller MUST convert the local birth time to
 * UTC before constructing this record — the engine performs no timezone
 * guessing, because a guessed timezone is a bluffed nakshatra.
 */
export class BirthData extends Record {
    constructor(UtcBirthInstant, Coordinates) {
        super();
        this.UtcBirthInstant = UtcBirthInstant;
        this.Coordinates = Coordinates;
    }
}

export function BirthData_$reflection() {
    return record_type("Bhavishyawani.BirthData", [], BirthData, () => [["UtcBirthInstant", class_type("System.DateTime")], ["Coordinates", GeoCoordinates_$reflection()]]);
}

/**
 * The four primary rekhas read by classical hasta-samudrika.
 */
export class PrimaryLine extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["HeartLine", "HeadLine", "LifeLine", "FateLine"];
    }
}

export function PrimaryLine_$reflection() {
    return union_type("Bhavishyawani.PrimaryLine", [], PrimaryLine, () => [[], [], [], []]);
}

/**
 * The structural state of a rekha. Exactly one state per observed line;
 * an unobserved line is simply absent from the map (never "unknown-ish").
 */
export class LineState extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Deep", "Chained", "Broken", "Forked"];
    }
}

export function LineState_$reflection() {
    return union_type("Bhavishyawani.LineState", [], LineState, () => [[], [], [], []]);
}

/**
 * The four mounts (parvata) cross-referenced by this engine.
 */
export class MountName extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Jupiter", "Saturn", "Sun", "Mercury"];
    }
}

export function MountName_$reflection() {
    return union_type("Bhavishyawani.MountName", [], MountName, () => [[], [], [], []]);
}

export class MountProminence extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["High", "Flat", "Depressed"];
    }
}

export function MountProminence_$reflection() {
    return union_type("Bhavishyawani.MountProminence", [], MountProminence, () => [[], [], []]);
}

export class PalmMetrics extends Record {
    constructor(Lines, Mounts) {
        super();
        this.Lines = Lines;
        this.Mounts = Mounts;
    }
}

export function PalmMetrics_$reflection() {
    return record_type("Bhavishyawani.PalmMetrics", [], PalmMetrics, () => [["Lines", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [PrimaryLine_$reflection(), LineState_$reflection()])], ["Mounts", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [MountName_$reflection(), MountProminence_$reflection()])]]);
}

/**
 * The auspicious markings catalogued by the Samudrika corpus
 * (Garuda Purana, Purvakhanda; Brihat Samhita, Purusha-lakshana).
 */
export class AuspiciousMarking extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Lotus", "Fish", "Trident", "Conch", "Temple"];
    }
}

export function AuspiciousMarking_$reflection() {
    return union_type("Bhavishyawani.AuspiciousMarking", [], AuspiciousMarking, () => [[], [], [], [], []]);
}

/**
 * A marking is only meaningful at a specific location; the pair is atomic.
 */
export class PhysicalSign extends Record {
    constructor(Marking, Location) {
        super();
        this.Marking = Marking;
        this.Location = Location;
    }
}

export function PhysicalSign_$reflection() {
    return record_type("Bhavishyawani.PhysicalSign", [], PhysicalSign, () => [["Marking", AuspiciousMarking_$reflection()], ["Location", MountName_$reflection()]]);
}

export class UserMetrics extends Record {
    constructor(BirthData, PalmMetrics, PhysicalSigns) {
        super();
        this.BirthData = BirthData;
        this.PalmMetrics = PalmMetrics;
        this.PhysicalSigns = PhysicalSigns;
    }
}

export function UserMetrics_$reflection() {
    return record_type("Bhavishyawani.UserMetrics", [], UserMetrics, () => [["BirthData", BirthData_$reflection()], ["PalmMetrics", PalmMetrics_$reflection()], ["PhysicalSigns", option_type(list_type(PhysicalSign_$reflection()))]]);
}

/**
 * A half-open interval of real time: [RangeStart, RangeEnd).
 */
export class DateRange extends Record {
    constructor(RangeStart, RangeEnd) {
        super();
        this.RangeStart = RangeStart;
        this.RangeEnd = RangeEnd;
    }
}

export function DateRange_$reflection() {
    return record_type("Bhavishyawani.DateRange", [], DateRange, () => [["RangeStart", class_type("System.DateTime")], ["RangeEnd", class_type("System.DateTime")]]);
}

/**
 * Every emitted event is either a check against the native's past (trust
 * establishment) or a forward projection. Never both, never neither.
 */
export class TimelineType extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["PastVerification", "FuturePrediction"];
    }
}

export function TimelineType_$reflection() {
    return union_type("Bhavishyawani.TimelineType", [], TimelineType, () => [[], []]);
}

