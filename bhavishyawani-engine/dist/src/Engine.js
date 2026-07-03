
import { Record, Union } from "../fable-library/Types.js";
import { list_type, record_type, union_type, int32_type, class_type, float64_type } from "../fable-library/Reflection.js";
import { Astronomy_moonNakshatraAt, MoonNakshatraPosition_$reflection } from "./Astronomy.js";
import { Lagna_determineMarakas, Lagna_lagnaAt, MarakaDetermination_$reflection, LagnaPosition_$reflection } from "./Lagna.js";
import { RuleMatrix_rules, DashaContext, RuleMatrix_run, TimelineEvent_$reflection } from "./RuleMatrix.js";
import { empty, singleton, append, delay, toList } from "../fable-library/Seq.js";
import { utcNow, compare, year } from "../fable-library/Date.js";
import { isEmpty } from "../fable-library/Map.js";
import { defaultArg } from "../fable-library/Option.js";
import { sortBy, length, singleton as singleton_1, isEmpty as isEmpty_1, empty as empty_1 } from "../fable-library/List.js";
import { Vimshottari_buildTimeline } from "./VimshottariDasha.js";

/**
 * Why the engine refuses to answer. Each case names the exact deficiency so
 * the caller knows precisely what observation would unlock a verdict.
 */
export class InsufficiencyReason extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["MoonOnNakshatraBoundary", "InvalidCoordinates", "PolarLatitudeUnsupported", "BirthInstantOutOfCalibratedRange", "NoPalmParametersObserved", "NoClassicalRuleAlignment"];
    }
}

export function InsufficiencyReason_$reflection() {
    return union_type("Bhavishyawani.InsufficiencyReason", [], InsufficiencyReason, () => [[["siderealLongitude", float64_type], ["toleranceDegrees", float64_type]], [["latitude", float64_type], ["longitude", float64_type]], [["latitude", float64_type]], [["Item", class_type("System.DateTime")]], [], [["rulesEvaluated", int32_type]]]);
}

/**
 * The computed skeleton of the chart: what the mathematics fixed before any
 * rule was consulted. Carried on every successful verdict for auditability.
 */
export class NatalChart extends Record {
    constructor(Moon, Lagna, Marakas) {
        super();
        this.Moon = Moon;
        this.Lagna = Lagna;
        this.Marakas = Marakas;
    }
}

export function NatalChart_$reflection() {
    return record_type("Bhavishyawani.NatalChart", [], NatalChart, () => [["Moon", MoonNakshatraPosition_$reflection()], ["Lagna", LagnaPosition_$reflection()], ["Marakas", MarakaDetermination_$reflection()]]);
}

/**
 * The engine's verdict.
 */
export class DestinyReading extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["ExactTimeline", "InsufficientDataForExactPrediction"];
    }
}

export function DestinyReading_$reflection() {
    return union_type("Bhavishyawani.DestinyReading", [], DestinyReading, () => [[["chart", NatalChart_$reflection()], ["events", list_type(TimelineEvent_$reflection())]], [["Item", list_type(InsufficiencyReason_$reflection())]]]);
}

function Engine_validate(m) {
    const birth = m.BirthData.UtcBirthInstant;
    const c = m.BirthData.Coordinates;
    return toList(delay(() => append(((((c.Latitude < -90) ? true : (c.Latitude > 90)) ? true : (c.Longitude < -180)) ? true : (c.Longitude > 180)) ? singleton(new InsufficiencyReason(1, [c.Latitude, c.Longitude])) : ((Math.abs(c.Latitude) > 66.5) ? singleton(new InsufficiencyReason(2, [c.Latitude])) : empty()), delay(() => append(((year(birth) < 1800) ? true : (year(birth) > 2200)) ? singleton(new InsufficiencyReason(3, [birth])) : empty(), delay(() => (((isEmpty(m.PalmMetrics.Lines) && isEmpty(m.PalmMetrics.Mounts)) && isEmpty_1(defaultArg(m.PhysicalSigns, empty_1()))) ? singleton(new InsufficiencyReason(4, [])) : empty())))))));
}

/**
 * Pure core: the evaluation instant is a parameter, so identical inputs
 * always produce the identical verdict — testable, replayable, honest.
 */
export function Engine_evaluateDestinyAt(evaluationInstant, metrics) {
    const matchValue = Engine_validate(metrics);
    if (isEmpty_1(matchValue)) {
        const birth = metrics.BirthData.UtcBirthInstant;
        const moon = Astronomy_moonNakshatraAt(birth);
        if (moon.DistanceToNearestBoundary < 0.4) {
            return new DestinyReading(1, [singleton_1(new InsufficiencyReason(0, [moon.SiderealLongitude, 0.4]))]);
        }
        else {
            const lagna = Lagna_lagnaAt(birth, metrics.BirthData.Coordinates);
            const marakas = Lagna_determineMarakas(0.5, lagna);
            const chart = new NatalChart(moon, lagna, marakas);
            const events = RuleMatrix_run(evaluationInstant, metrics, new DashaContext(marakas), Vimshottari_buildTimeline(birth, moon));
            if (isEmpty_1(events)) {
                return new DestinyReading(1, [singleton_1(new InsufficiencyReason(5, [length(RuleMatrix_rules)]))]);
            }
            else {
                return new DestinyReading(0, [chart, sortBy((e) => e.Period.RangeStart, events, {
                    Compare: (x, y) => (compare(x, y) | 0),
                })]);
            }
        }
    }
    else {
        return new DestinyReading(1, [matchValue]);
    }
}

/**
 * Convenience entry point pinned to the current instant. Past windows
 * come back as PastVerification (trust establishment), later windows as
 * FuturePrediction.
 */
export function Engine_evaluateDestiny(metrics) {
    return Engine_evaluateDestinyAt(utcNow(), metrics);
}

