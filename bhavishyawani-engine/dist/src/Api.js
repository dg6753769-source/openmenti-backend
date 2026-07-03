
import { Record } from "../fable-library/Types.js";
import { array_type, float64_type, string_type, record_type, int32_type } from "../fable-library/Reflection.js";
import { join, printf, toText } from "../fable-library/String.js";
import { Vimshottari_grahaName } from "./VimshottariDasha.js";
import { Lagna_rashiName } from "./Lagna.js";
import { toArray, isEmpty, collect, choose, empty, append, singleton, ofArray, map } from "../fable-library/List.js";
import { utcNow, create, daysInMonth, second, minute, hour, day, month, year } from "../fable-library/Date.js";
import { FSharpResult$2 } from "../fable-library/Result.js";
import { UserMetrics, PalmMetrics, BirthData, GeoCoordinates, PrimaryLine, PhysicalSign, MountName, AuspiciousMarking, MountProminence, LineState } from "./Domain.js";
import { ofList } from "../fable-library/Map.js";
import { compare } from "../fable-library/Util.js";
import { map as map_1, defaultArg } from "../fable-library/Option.js";
import { ClassicalSources_citation } from "./ClassicalSources.js";
import { Astronomy_nakshatraName } from "./Astronomy.js";
import { Engine_evaluateDestinyAt } from "./Engine.js";

/**
 * Exact UTC birth instant as plain numbers — no string parsing, no timezone
 * ambiguity at the boundary.
 */
export class BirthInstantDto extends Record {
    constructor(year, month, day, hourUtc, minuteUtc, secondUtc) {
        super();
        this.year = (year | 0);
        this.month = (month | 0);
        this.day = (day | 0);
        this.hourUtc = (hourUtc | 0);
        this.minuteUtc = (minuteUtc | 0);
        this.secondUtc = (secondUtc | 0);
    }
}

export function BirthInstantDto_$reflection() {
    return record_type("Bhavishyawani.BirthInstantDto", [], BirthInstantDto, () => [["year", int32_type], ["month", int32_type], ["day", int32_type], ["hourUtc", int32_type], ["minuteUtc", int32_type], ["secondUtc", int32_type]]);
}

export class SignDto extends Record {
    constructor(marking, location) {
        super();
        this.marking = marking;
        this.location = location;
    }
}

export function SignDto_$reflection() {
    return record_type("Bhavishyawani.SignDto", [], SignDto, () => [["marking", string_type], ["location", string_type]]);
}

export class UserMetricsDto extends Record {
    constructor(birthUtc, latitude, longitude, heartLine, headLine, lifeLine, fateLine, jupiterMount, saturnMount, sunMount, mercuryMount, signs) {
        super();
        this.birthUtc = birthUtc;
        this.latitude = latitude;
        this.longitude = longitude;
        this.heartLine = heartLine;
        this.headLine = headLine;
        this.lifeLine = lifeLine;
        this.fateLine = fateLine;
        this.jupiterMount = jupiterMount;
        this.saturnMount = saturnMount;
        this.sunMount = sunMount;
        this.mercuryMount = mercuryMount;
        this.signs = signs;
    }
}

export function UserMetricsDto_$reflection() {
    return record_type("Bhavishyawani.UserMetricsDto", [], UserMetricsDto, () => [["birthUtc", BirthInstantDto_$reflection()], ["latitude", float64_type], ["longitude", float64_type], ["heartLine", string_type], ["headLine", string_type], ["lifeLine", string_type], ["fateLine", string_type], ["jupiterMount", string_type], ["saturnMount", string_type], ["sunMount", string_type], ["mercuryMount", string_type], ["signs", array_type(SignDto_$reflection())]]);
}

export class TimelineEventDto extends Record {
    constructor(eventType, ruleId, startUtcIso, endUtcIso, peakStartUtcIso, peakEndUtcIso, ageStart, ageEnd, systemsAligned, witnesses, reading, sources) {
        super();
        this.eventType = eventType;
        this.ruleId = ruleId;
        this.startUtcIso = startUtcIso;
        this.endUtcIso = endUtcIso;
        this.peakStartUtcIso = peakStartUtcIso;
        this.peakEndUtcIso = peakEndUtcIso;
        this.ageStart = ageStart;
        this.ageEnd = ageEnd;
        this.systemsAligned = systemsAligned;
        this.witnesses = witnesses;
        this.reading = reading;
        this.sources = sources;
    }
}

export function TimelineEventDto_$reflection() {
    return record_type("Bhavishyawani.TimelineEventDto", [], TimelineEventDto, () => [["eventType", string_type], ["ruleId", string_type], ["startUtcIso", string_type], ["endUtcIso", string_type], ["peakStartUtcIso", string_type], ["peakEndUtcIso", string_type], ["ageStart", float64_type], ["ageEnd", float64_type], ["systemsAligned", array_type(string_type)], ["witnesses", array_type(string_type)], ["reading", string_type], ["sources", array_type(string_type)]]);
}

export class ReadingDto extends Record {
    constructor(status, moonNakshatra, moonSiderealLongitude, lagnaRashi, lagnaSiderealLongitude, marakaBasis, events, reasons) {
        super();
        this.status = status;
        this.moonNakshatra = moonNakshatra;
        this.moonSiderealLongitude = moonSiderealLongitude;
        this.lagnaRashi = lagnaRashi;
        this.lagnaSiderealLongitude = lagnaSiderealLongitude;
        this.marakaBasis = marakaBasis;
        this.events = events;
        this.reasons = reasons;
    }
}

export function ReadingDto_$reflection() {
    return record_type("Bhavishyawani.ReadingDto", [], ReadingDto, () => [["status", string_type], ["moonNakshatra", string_type], ["moonSiderealLongitude", float64_type], ["lagnaRashi", string_type], ["lagnaSiderealLongitude", float64_type], ["marakaBasis", string_type], ["events", array_type(TimelineEventDto_$reflection())], ["reasons", array_type(string_type)]]);
}

function Api_lineName(l) {
    switch (l.tag) {
        case 1:
            return "Head";
        case 2:
            return "Life";
        case 3:
            return "Fate";
        default:
            return "Heart";
    }
}

function Api_lineStateName(s) {
    switch (s.tag) {
        case 1:
            return "Chained";
        case 2:
            return "Broken";
        case 3:
            return "Forked";
        default:
            return "Deep";
    }
}

function Api_mountName(m) {
    switch (m.tag) {
        case 1:
            return "Saturn";
        case 2:
            return "Sun";
        case 3:
            return "Mercury";
        default:
            return "Jupiter";
    }
}

function Api_prominenceName(p) {
    switch (p.tag) {
        case 1:
            return "Flat";
        case 2:
            return "Depressed";
        default:
            return "High";
    }
}

function Api_markingName(m) {
    switch (m.tag) {
        case 1:
            return "Fish";
        case 2:
            return "Trident";
        case 3:
            return "Conch";
        case 4:
            return "Temple";
        default:
            return "Lotus";
    }
}

function Api_ruleIdName(r) {
    switch (r.tag) {
        case 1:
            return "DharmaKarmaAscent";
        case 2:
            return "SaturnVenusRelationalStrain";
        case 3:
            return "LakshmiProsperityWindow";
        case 4:
            return "BuddhiCommerceWindow";
        case 5:
            return "SuryaVitalityWindow";
        default:
            return "MarakaWindowOnBrokenLifeLine";
    }
}

function Api_systemName(s) {
    switch (s.tag) {
        case 1:
            return "ParasharaLagna";
        case 2:
            return "SamudrikaPalm";
        case 3:
            return "SamudrikaDeha";
        default:
            return "ParasharaDasha";
    }
}

function Api_eventTypeName(t) {
    if (t.tag === 1) {
        return "FuturePrediction";
    }
    else {
        return "PastVerification";
    }
}

function Api_witnessDescription(w) {
    switch (w.tag) {
        case 1: {
            const arg_2 = Api_mountName(w.fields[0]);
            const arg_3 = Api_prominenceName(w.fields[1]);
            return toText(printf("%s mount: %s"))(arg_2)(arg_3);
        }
        case 2: {
            const sign = w.fields[0];
            const arg_4 = Api_markingName(sign.Marking);
            const arg_5 = Api_mountName(sign.Location);
            return toText(printf("%s marking on the %s mount"))(arg_4)(arg_5);
        }
        case 3: {
            const arg_6 = Vimshottari_grahaName(w.fields[0]);
            const arg_7 = Vimshottari_grahaName(w.fields[1]);
            return toText(printf("%s maha-dasha / %s antar-dasha"))(arg_6)(arg_7);
        }
        case 4: {
            const arg_8 = Lagna_rashiName(w.fields[0]);
            const arg_9 = join(", ", map(Vimshottari_grahaName, w.fields[1]));
            return toText(printf("Lagna %s; maraka lords: %s"))(arg_8)(arg_9);
        }
        default: {
            const arg = Api_lineName(w.fields[0]);
            const arg_1 = Api_lineStateName(w.fields[1]);
            return toText(printf("%s line: %s"))(arg)(arg_1);
        }
    }
}

function Api_reasonDescription(r) {
    switch (r.tag) {
        case 1:
            return toText(printf("Coordinates (%.4f, %.4f) are outside physical range."))(r.fields[0])(r.fields[1]);
        case 2:
            return toText(printf("Birth latitude %.4f° lies inside the polar circles, where the rising point degenerates; the ascendant cannot be computed honestly."))(r.fields[0]);
        case 3: {
            const arg_5 = year(r.fields[0]) | 0;
            return toText(printf("Birth year %d is outside 1800-2200, the range for which the lunar theory\'s error bound is stated."))(arg_5);
        }
        case 4:
            return "No palm line, mount or body marking was observed; the Samudrika side of every cross-reference is empty, so no two systems can align.";
        case 5:
            return toText(printf("All inputs were valid, but none of the %d classical rules found two independent systems in agreement. Silence is the verdict."))(r.fields[0]);
        default:
            return toText(printf("Natal Moon at %.3f° sidereal sits within %.2f° of a nakshatra boundary; the opening dasha lord cannot be asserted at the engine\'s stated precision. A more exact birth time or a higher-precision ephemeris is required."))(r.fields[0])(r.fields[1]);
    }
}

function Api_marakaBasisDescription(m) {
    if (m.tag === 1) {
        return toText(printf("Natural fallback: ascendant %.3f° sidereal is within %.2f° of a rashi boundary, so exact lords are withheld."))(m.fields[0])(m.fields[1]);
    }
    else {
        const arg = Lagna_rashiName(m.fields[0]);
        const arg_1 = join(", ", map(Vimshottari_grahaName, m.fields[1]));
        return toText(printf("Exact (BPHS 2nd/7th lords of %s): %s"))(arg)(arg_1);
    }
}

function Api_isoUtc(d) {
    const arg = year(d) | 0;
    const arg_1 = month(d) | 0;
    const arg_2 = day(d) | 0;
    const arg_3 = hour(d) | 0;
    const arg_4 = minute(d) | 0;
    const arg_5 = second(d) | 0;
    return toText(printf("%04d-%02d-%02dT%02d:%02d:%02dZ"))(arg)(arg_1)(arg_2)(arg_3)(arg_4)(arg_5);
}

function Api_parseLineState(field, raw) {
    switch (raw) {
        case "":
            return new FSharpResult$2(0, [undefined]);
        case "Deep":
            return new FSharpResult$2(0, [new LineState(0, [])]);
        case "Chained":
            return new FSharpResult$2(0, [new LineState(1, [])]);
        case "Broken":
            return new FSharpResult$2(0, [new LineState(2, [])]);
        case "Forked":
            return new FSharpResult$2(0, [new LineState(3, [])]);
        default:
            return new FSharpResult$2(1, [toText(printf("%s: unrecognised line state \'%s\' (expected Deep|Chained|Broken|Forked or empty)"))(field)(raw)]);
    }
}

function Api_parseProminence(field, raw) {
    switch (raw) {
        case "":
            return new FSharpResult$2(0, [undefined]);
        case "High":
            return new FSharpResult$2(0, [new MountProminence(0, [])]);
        case "Flat":
            return new FSharpResult$2(0, [new MountProminence(1, [])]);
        case "Depressed":
            return new FSharpResult$2(0, [new MountProminence(2, [])]);
        default:
            return new FSharpResult$2(1, [toText(printf("%s: unrecognised prominence \'%s\' (expected High|Flat|Depressed or empty)"))(field)(raw)]);
    }
}

function Api_parseMarking(raw) {
    switch (raw) {
        case "Lotus":
            return new FSharpResult$2(0, [new AuspiciousMarking(0, [])]);
        case "Fish":
            return new FSharpResult$2(0, [new AuspiciousMarking(1, [])]);
        case "Trident":
            return new FSharpResult$2(0, [new AuspiciousMarking(2, [])]);
        case "Conch":
            return new FSharpResult$2(0, [new AuspiciousMarking(3, [])]);
        case "Temple":
            return new FSharpResult$2(0, [new AuspiciousMarking(4, [])]);
        default:
            return new FSharpResult$2(1, [toText(printf("signs.marking: unrecognised marking \'%s\' (expected Lotus|Fish|Trident|Conch|Temple)"))(raw)]);
    }
}

function Api_parseMountLocation(raw) {
    switch (raw) {
        case "Jupiter":
            return new FSharpResult$2(0, [new MountName(0, [])]);
        case "Saturn":
            return new FSharpResult$2(0, [new MountName(1, [])]);
        case "Sun":
            return new FSharpResult$2(0, [new MountName(2, [])]);
        case "Mercury":
            return new FSharpResult$2(0, [new MountName(3, [])]);
        default:
            return new FSharpResult$2(1, [toText(printf("signs.location: unrecognised mount \'%s\' (expected Jupiter|Saturn|Sun|Mercury)"))(raw)]);
    }
}

function Api_parseBirth(b) {
    if ((b.year < 1800) ? true : (b.year > 2200)) {
        return new FSharpResult$2(1, [toText(printf("birthUtc.year: %d is outside the calibrated range 1800-2200"))(b.year)]);
    }
    else if ((b.month < 1) ? true : (b.month > 12)) {
        return new FSharpResult$2(1, [toText(printf("birthUtc.month: %d is not a calendar month"))(b.month)]);
    }
    else if ((b.day < 1) ? true : (b.day > daysInMonth(b.year, b.month))) {
        return new FSharpResult$2(1, [toText(printf("birthUtc.day: %d is invalid for %04d-%02d"))(b.day)(b.year)(b.month)]);
    }
    else if ((b.hourUtc < 0) ? true : (b.hourUtc > 23)) {
        return new FSharpResult$2(1, [toText(printf("birthUtc.hourUtc: %d is not a valid hour"))(b.hourUtc)]);
    }
    else if ((b.minuteUtc < 0) ? true : (b.minuteUtc > 59)) {
        return new FSharpResult$2(1, [toText(printf("birthUtc.minuteUtc: %d is not a valid minute"))(b.minuteUtc)]);
    }
    else if ((b.secondUtc < 0) ? true : (b.secondUtc > 59)) {
        return new FSharpResult$2(1, [toText(printf("birthUtc.secondUtc: %d is not a valid second"))(b.secondUtc)]);
    }
    else {
        return new FSharpResult$2(0, [create(b.year, b.month, b.day, b.hourUtc, b.minuteUtc, b.secondUtc, 0, 1)]);
    }
}

function Api_parseSign(s) {
    const matchValue = Api_parseMarking(s.marking);
    const matchValue_1 = Api_parseMountLocation(s.location);
    const copyOfStruct = matchValue;
    if (copyOfStruct.tag === 1) {
        const copyOfStruct_1 = matchValue_1;
        if (copyOfStruct_1.tag === 1) {
            return new FSharpResult$2(1, [ofArray([copyOfStruct.fields[0], copyOfStruct_1.fields[0]])]);
        }
        else {
            return new FSharpResult$2(1, [singleton(copyOfStruct.fields[0])]);
        }
    }
    else {
        const copyOfStruct_2 = matchValue_1;
        if (copyOfStruct_2.tag === 1) {
            return new FSharpResult$2(1, [singleton(copyOfStruct_2.fields[0])]);
        }
        else {
            return new FSharpResult$2(0, [new PhysicalSign(copyOfStruct.fields[0], copyOfStruct_2.fields[0])]);
        }
    }
}

/**
 * Validates and lifts the boundary DTO into the typed domain, or reports
 * every offending field at once.
 */
export function Api_toUserMetrics(dto) {
    const birthResult = Api_parseBirth(dto.birthUtc);
    const lineResults = ofArray([[new PrimaryLine(0, []), Api_parseLineState("heartLine", dto.heartLine)], [new PrimaryLine(1, []), Api_parseLineState("headLine", dto.headLine)], [new PrimaryLine(2, []), Api_parseLineState("lifeLine", dto.lifeLine)], [new PrimaryLine(3, []), Api_parseLineState("fateLine", dto.fateLine)]]);
    const mountResults = ofArray([[new MountName(0, []), Api_parseProminence("jupiterMount", dto.jupiterMount)], [new MountName(1, []), Api_parseProminence("saturnMount", dto.saturnMount)], [new MountName(2, []), Api_parseProminence("sunMount", dto.sunMount)], [new MountName(3, []), Api_parseProminence("mercuryMount", dto.mercuryMount)]]);
    const signResults = map(Api_parseSign, ofArray(dto.signs));
    const errors = append((birthResult.tag === 0) ? empty() : singleton(birthResult.fields[0]), append(choose((tupledArg) => {
        const r = tupledArg[1];
        if (r.tag === 0) {
            return undefined;
        }
        else {
            return r.fields[0];
        }
    }, lineResults), append(choose((tupledArg_1) => {
        const r_1 = tupledArg_1[1];
        if (r_1.tag === 0) {
            return undefined;
        }
        else {
            return r_1.fields[0];
        }
    }, mountResults), collect((r_2) => {
        if (r_2.tag === 0) {
            return empty();
        }
        else {
            return r_2.fields[0];
        }
    }, signResults))));
    let matchResult, birth;
    const copyOfStruct = birthResult;
    if (copyOfStruct.tag === 0) {
        if (isEmpty(errors)) {
            matchResult = 0;
            birth = copyOfStruct.fields[0];
        }
        else {
            matchResult = 1;
        }
    }
    else {
        matchResult = 1;
    }
    switch (matchResult) {
        case 0: {
            const lines = ofList(choose((tupledArg_2) => {
                const r_3 = tupledArg_2[1];
                let matchResult_1;
                if (r_3.tag === 0) {
                    if (r_3.fields[0] != null) {
                        matchResult_1 = 0;
                    }
                    else {
                        matchResult_1 = 1;
                    }
                }
                else {
                    matchResult_1 = 1;
                }
                switch (matchResult_1) {
                    case 0:
                        return [tupledArg_2[0], r_3.fields[0]];
                    default:
                        return undefined;
                }
            }, lineResults), {
                Compare: (x, y) => (compare(x, y) | 0),
            });
            const mounts = ofList(choose((tupledArg_3) => {
                const r_4 = tupledArg_3[1];
                let matchResult_2;
                if (r_4.tag === 0) {
                    if (r_4.fields[0] != null) {
                        matchResult_2 = 0;
                    }
                    else {
                        matchResult_2 = 1;
                    }
                }
                else {
                    matchResult_2 = 1;
                }
                switch (matchResult_2) {
                    case 0:
                        return [tupledArg_3[0], r_4.fields[0]];
                    default:
                        return undefined;
                }
            }, mountResults), {
                Compare: (x_1, y_1) => (compare(x_1, y_1) | 0),
            });
            const signs = choose((r_5) => {
                if (r_5.tag === 1) {
                    return undefined;
                }
                else {
                    return r_5.fields[0];
                }
            }, signResults);
            return new FSharpResult$2(0, [new UserMetrics(new BirthData(birth, new GeoCoordinates(dto.latitude, dto.longitude)), new PalmMetrics(lines, mounts), isEmpty(signs) ? undefined : signs)]);
        }
        default:
            return new FSharpResult$2(1, [errors]);
    }
}

function Api_toEventDto(e) {
    return new TimelineEventDto(Api_eventTypeName(e.EventType), Api_ruleIdName(e.RuleId), Api_isoUtc(e.Period.RangeStart), Api_isoUtc(e.Period.RangeEnd), defaultArg(map_1((p) => Api_isoUtc(p.RangeStart), e.PeakFocus), ""), defaultArg(map_1((p_1) => Api_isoUtc(p_1.RangeEnd), e.PeakFocus), ""), e.AgeSpan[0], e.AgeSpan[1], toArray(map(Api_systemName, e.SystemsAligned)), toArray(map(Api_witnessDescription, e.Witnesses)), e.StructuralReading, toArray(map(ClassicalSources_citation, e.Sources)));
}

function Api_emptyChartDto(status, reasons) {
    return new ReadingDto(status, "", 0, "", 0, "", [], toArray(reasons));
}

function Api_toReadingDto(reading) {
    if (reading.tag === 1) {
        return Api_emptyChartDto("InsufficientData", map(Api_reasonDescription, reading.fields[0]));
    }
    else {
        const chart = reading.fields[0];
        return new ReadingDto("ExactTimeline", Astronomy_nakshatraName(chart.Moon.Nakshatra), chart.Moon.SiderealLongitude, Lagna_rashiName(chart.Lagna.Rashi), chart.Lagna.SiderealLongitude, Api_marakaBasisDescription(chart.Marakas), toArray(map(Api_toEventDto, reading.fields[1])), []);
    }
}

/**
 * Pure boundary core: evaluation instant is a parameter.
 */
export function Api_evaluateAt(evaluationInstant, dto) {
    const matchValue = Api_toUserMetrics(dto);
    if (matchValue.tag === 0) {
        return Api_toReadingDto(Engine_evaluateDestinyAt(evaluationInstant, matchValue.fields[0]));
    }
    else {
        return Api_emptyChartDto("InvalidInput", matchValue.fields[0]);
    }
}

/**
 * Convenience entry point pinned to the current instant — the function a
 * Node/browser caller invokes on the Fable-compiled module.
 */
export function Api_evaluate(dto) {
    return Api_evaluateAt(utcNow(), dto);
}

