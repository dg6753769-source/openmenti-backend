
import { Record, Union } from "../fable-library/Types.js";
import { lambda_type, string_type, tuple_type, float64_type, option_type, record_type, list_type, union_type } from "../fable-library/Reflection.js";
import { TimelineType, AuspiciousMarking, MountProminence, MountName, LineState, PrimaryLine, UserMetrics_$reflection, DateRange_$reflection, TimelineType_$reflection, PhysicalSign_$reflection, MountProminence_$reflection, MountName_$reflection, LineState_$reflection, PrimaryLine_$reflection } from "./Domain.js";
import { Vimshottari_ageInYearsAt, Graha, Vimshottari_grahaName, Graha_$reflection } from "./VimshottariDasha.js";
import { Lagna_rashiName, MarakaDetermination_$reflection, Rashi_$reflection } from "./Lagna.js";
import { ClassicalSources_references, RuleId, ClassicalSource_$reflection, RuleId_$reflection } from "./ClassicalSources.js";
import { tryFind } from "../fable-library/Map.js";
import { compare, safeHash, equals } from "../fable-library/Util.js";
import { defaultArg, map } from "../fable-library/Option.js";
import { tryHead, length, append, cons, ofArray, singleton, choose, forAll, map as map_1, empty, contains, tryFind as tryFind_1 } from "../fable-library/List.js";
import { contains as contains_1, ofList } from "../fable-library/Set.js";
import { printf, toText, join } from "../fable-library/String.js";
import { empty as empty_1, singleton as singleton_1, collect, delay, toList } from "../fable-library/Seq.js";
import { List_distinct } from "../fable-library/Seq2.js";
import { compare as compare_1 } from "../fable-library/Date.js";

/**
 * Which classical system contributed a piece of evidence.
 */
export class KnowledgeSystem extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["ParasharaDasha", "ParasharaLagna", "SamudrikaPalm", "SamudrikaDeha"];
    }
}

export function KnowledgeSystem_$reflection() {
    return union_type("Bhavishyawani.KnowledgeSystem", [], KnowledgeSystem, () => [[], [], [], []]);
}

/**
 * A concrete piece of evidence that fired a rule — kept on the event so a
 * caller (or the native) can audit exactly why the window was flagged.
 */
export class SystemWitness extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["LineWitness", "MountWitness", "MarkingWitness", "DashaWitness", "LagnaWitness"];
    }
}

export function SystemWitness_$reflection() {
    return union_type("Bhavishyawani.SystemWitness", [], SystemWitness, () => [[["Item1", PrimaryLine_$reflection()], ["Item2", LineState_$reflection()]], [["Item1", MountName_$reflection()], ["Item2", MountProminence_$reflection()]], [["Item", PhysicalSign_$reflection()]], [["mahaLord", Graha_$reflection()], ["antarLord", Graha_$reflection()]], [["lagna", Rashi_$reflection()], ["marakaLords", list_type(Graha_$reflection())]]]);
}

/**
 * Chart-level facts the temporal gates may consult.
 */
export class DashaContext extends Record {
    constructor(Marakas) {
        super();
        this.Marakas = Marakas;
    }
}

export function DashaContext_$reflection() {
    return record_type("Bhavishyawani.DashaContext", [], DashaContext, () => [["Marakas", MarakaDetermination_$reflection()]]);
}

export class TimelineEvent extends Record {
    constructor(EventType, RuleId, Period, PeakFocus, AgeSpan, Witnesses, SystemsAligned, StructuralReading, Sources) {
        super();
        this.EventType = EventType;
        this.RuleId = RuleId;
        this.Period = Period;
        this.PeakFocus = PeakFocus;
        this.AgeSpan = AgeSpan;
        this.Witnesses = Witnesses;
        this.SystemsAligned = SystemsAligned;
        this.StructuralReading = StructuralReading;
        this.Sources = Sources;
    }
}

export function TimelineEvent_$reflection() {
    return record_type("Bhavishyawani.TimelineEvent", [], TimelineEvent, () => [["EventType", TimelineType_$reflection()], ["RuleId", RuleId_$reflection()], ["Period", DateRange_$reflection()], ["PeakFocus", option_type(DateRange_$reflection())], ["AgeSpan", tuple_type(float64_type, float64_type)], ["Witnesses", list_type(SystemWitness_$reflection())], ["SystemsAligned", list_type(KnowledgeSystem_$reflection())], ["StructuralReading", string_type], ["Sources", list_type(ClassicalSource_$reflection())]]);
}

/**
 * One row of the matrix.
 */
export class CrossReferenceRule extends Record {
    constructor(Id, StructuralGate, TemporalGate, Reading) {
        super();
        this.Id = Id;
        this.StructuralGate = StructuralGate;
        this.TemporalGate = TemporalGate;
        this.Reading = Reading;
    }
}

export function CrossReferenceRule_$reflection() {
    return record_type("Bhavishyawani.CrossReferenceRule", [], CrossReferenceRule, () => [["Id", RuleId_$reflection()], ["StructuralGate", lambda_type(UserMetrics_$reflection(), option_type(list_type(SystemWitness_$reflection())))], ["TemporalGate", lambda_type(DashaContext_$reflection(), lambda_type(Graha_$reflection(), lambda_type(Graha_$reflection(), option_type(list_type(SystemWitness_$reflection())))))], ["Reading", lambda_type(DashaContext_$reflection(), lambda_type(Graha_$reflection(), lambda_type(Graha_$reflection(), lambda_type(float64_type, lambda_type(float64_type, string_type)))))]]);
}

function RuleMatrix_lineIs(line, state, m) {
    const matchValue = tryFind(line, m.PalmMetrics.Lines);
    let matchResult, observed_1;
    if (matchValue != null) {
        if (equals(matchValue, state)) {
            matchResult = 0;
            observed_1 = matchValue;
        }
        else {
            matchResult = 1;
        }
    }
    else {
        matchResult = 1;
    }
    switch (matchResult) {
        case 0:
            return new SystemWitness(0, [line, state]);
        default:
            return undefined;
    }
}

function RuleMatrix_mountIs(mount, prominence, m) {
    const matchValue = tryFind(mount, m.PalmMetrics.Mounts);
    let matchResult, observed_1;
    if (matchValue != null) {
        if (equals(matchValue, prominence)) {
            matchResult = 0;
            observed_1 = matchValue;
        }
        else {
            matchResult = 1;
        }
    }
    else {
        matchResult = 1;
    }
    switch (matchResult) {
        case 0:
            return new SystemWitness(1, [mount, prominence]);
        default:
            return undefined;
    }
}

function RuleMatrix_markingOn(markings, locations, m) {
    return map((Item) => (new SystemWitness(2, [Item])), tryFind_1((s) => {
        if (contains(s.Marking, markings, {
            Equals: equals,
            GetHashCode: (x) => (safeHash(x) | 0),
        })) {
            return contains(s.Location, locations, {
                Equals: equals,
                GetHashCode: (x_1) => (safeHash(x_1) | 0),
            });
        }
        else {
            return false;
        }
    }, defaultArg(m.PhysicalSigns, empty())));
}

function RuleMatrix_allOf(gates, m) {
    const hits = map_1((g) => g(m), gates);
    if (forAll((option) => (option != null), hits)) {
        return choose((x) => x, hits);
    }
    else {
        return undefined;
    }
}

function RuleMatrix_dashaOnly(predicate, _arg, maha, antar) {
    if (predicate(maha, antar)) {
        return singleton(new SystemWitness(3, [maha, antar]));
    }
    else {
        return undefined;
    }
}

const RuleMatrix_grahaName = Vimshottari_grahaName;

const RuleMatrix_naturalMarakas = ofList(ofArray([new Graha(7, []), new Graha(4, [])]), {
    Compare: (x, y) => (compare(x, y) | 0),
});

function RuleMatrix_isNode(g) {
    if (equals(g, new Graha(5, []))) {
        return true;
    }
    else {
        return equals(g, new Graha(0, []));
    }
}

export const RuleMatrix_rules = ofArray([new CrossReferenceRule(new RuleId(0, []), (m_1) => RuleMatrix_allOf(singleton((m) => RuleMatrix_lineIs(new PrimaryLine(2, []), new LineState(2, []), m)), m_1), (ctx, maha, antar) => {
    let patternInput;
    const matchValue = ctx.Marakas;
    if (matchValue.tag === 1) {
        patternInput = [RuleMatrix_naturalMarakas, empty()];
    }
    else {
        const lords = matchValue.fields[1];
        patternInput = [ofList(lords, {
            Compare: (x, y) => (compare(x, y) | 0),
        }), singleton(new SystemWitness(4, [matchValue.fields[0], lords]))];
    }
    const isLord = (g) => contains_1(g, patternInput[0]);
    const isAgent = (g_1) => {
        if (isLord(g_1)) {
            return true;
        }
        else {
            return RuleMatrix_isNode(g_1);
        }
    };
    return ((isLord(maha) && isAgent(antar)) ? true : (isLord(antar) && isAgent(maha))) ? cons(new SystemWitness(3, [maha, antar]), patternInput[1]) : undefined;
}, (ctx_1, maha_1, antar_1, a0, a1) => {
    let basis;
    const matchValue_1 = ctx_1.Marakas;
    if (matchValue_1.tag === 1) {
        basis = "the natural maraka-natured grahas (ascendant too near a rashi boundary; exact lords withheld)";
    }
    else {
        const arg = Lagna_rashiName(matchValue_1.fields[0]);
        const arg_1 = join(", ", map_1(RuleMatrix_grahaName, matchValue_1.fields[1]));
        basis = toText(printf("the maraka lords of the natal %s lagna (%s; BPHS 2nd/7th lordship)"))(arg)(arg_1);
    }
    const arg_4 = RuleMatrix_grahaName(maha_1);
    const arg_5 = RuleMatrix_grahaName(antar_1);
    return toText(printf("Critical vigilance window, ages %.1f to %.1f: the Life line is Broken (Samudrika) while the Vimshottari clock runs the %s maha-dasha with the %s antar-dasha — a period governed by %s. Independent systems converge on a trial of health and vitality in exactly this span; physical risk and neglected ailments must be guarded against."))(a0)(a1)(arg_4)(arg_5)(basis);
}), new CrossReferenceRule(new RuleId(1, []), (m_4) => RuleMatrix_allOf(ofArray([(m_2) => RuleMatrix_lineIs(new PrimaryLine(3, []), new LineState(0, []), m_2), (m_3) => RuleMatrix_mountIs(new MountName(0, []), new MountProminence(0, []), m_3)]), m_4), (arg10$0040, maha_3, antar_3) => RuleMatrix_dashaOnly((maha_2, antar_2) => {
    if (equals(maha_2, new Graha(6, []))) {
        if (equals(antar_2, new Graha(6, []))) {
            return true;
        }
        else {
            return equals(antar_2, new Graha(2, []));
        }
    }
    else {
        return false;
    }
}, arg10$0040, maha_3, antar_3), (_arg, _arg_1, antar_4, a0_1, a1_1) => {
    const arg_9 = RuleMatrix_grahaName(antar_4);
    return toText(printf("Ascent of rank and dharma, ages %.1f to %.1f: a Deep Fate line over an elevated Guru mount (Samudrika) meets the Guru maha-dasha with the %s antar-dasha (Parashara). Authority, counsel and standing rise in this exact window; the gain is earned through duty, not chance."))(a0_1)(a1_1)(arg_9);
}), new CrossReferenceRule(new RuleId(2, []), (m_6) => RuleMatrix_allOf(singleton((m_5) => RuleMatrix_lineIs(new PrimaryLine(0, []), new LineState(1, []), m_5)), m_6), (arg10$0040_1, maha_5, antar_6) => RuleMatrix_dashaOnly((maha_4, antar_5) => {
    if (equals(maha_4, new Graha(7, [])) && equals(antar_5, new Graha(1, []))) {
        return true;
    }
    else if (equals(maha_4, new Graha(1, []))) {
        return equals(antar_5, new Graha(7, []));
    }
    else {
        return false;
    }
}, arg10$0040_1, maha_5, antar_6), (_arg_2, maha_6, antar_7, a0_2, a1_2) => {
    const arg_12 = RuleMatrix_grahaName(maha_6);
    const arg_13 = RuleMatrix_grahaName(antar_7);
    return toText(printf("Relational strain, ages %.1f to %.1f: the Heart line is Chained (Samudrika) while %s and %s interlock as maha- and antar-lords (Parashara). Bonds formed or tested in this exact span carry delay and obligation; commitments demand deliberate patience."))(a0_2)(a1_2)(arg_12)(arg_13);
}), new CrossReferenceRule(new RuleId(3, []), (m_7) => map((markWitness) => cons(markWitness, choose((x_1) => x_1, ofArray([RuleMatrix_mountIs(new MountName(0, []), new MountProminence(0, []), m_7), RuleMatrix_mountIs(new MountName(2, []), new MountProminence(0, []), m_7)]))), RuleMatrix_markingOn(ofArray([new AuspiciousMarking(1, []), new AuspiciousMarking(0, []), new AuspiciousMarking(3, [])]), ofArray([new MountName(0, []), new MountName(2, [])]), m_7)), (arg10$0040_2, maha_8, antar_9) => RuleMatrix_dashaOnly((maha_7, antar_8) => {
    if (equals(maha_7, new Graha(1, [])) ? true : equals(maha_7, new Graha(6, []))) {
        return equals(antar_8, maha_7);
    }
    else {
        return false;
    }
}, arg10$0040_2, maha_8, antar_9), (_arg_3, maha_9, _arg_4, a0_3, a1_3) => {
    const arg_16 = RuleMatrix_grahaName(maha_9);
    return toText(printf("Prosperity window, ages %.1f to %.1f: an auspicious mark of the Samudrika canon stands on a solar/jovian mount while %s rules both maha- and antar-dasha (Parashara). Wealth and recognition consolidate in exactly this span; what is begun here compounds."))(a0_3)(a1_3)(arg_16);
}), new CrossReferenceRule(new RuleId(4, []), (m_10) => RuleMatrix_allOf(ofArray([(m_8) => RuleMatrix_lineIs(new PrimaryLine(1, []), new LineState(3, []), m_8), (m_9) => RuleMatrix_mountIs(new MountName(3, []), new MountProminence(0, []), m_9)]), m_10), (arg10$0040_3, maha_11, antar_11) => RuleMatrix_dashaOnly((maha_10, antar_10) => {
    if (equals(maha_10, new Graha(8, []))) {
        if (equals(antar_10, new Graha(8, []))) {
            return true;
        }
        else {
            return equals(antar_10, new Graha(1, []));
        }
    }
    else {
        return false;
    }
}, arg10$0040_3, maha_11, antar_11), (_arg_5, _arg_6, antar_12, a0_4, a1_4) => {
    const arg_19 = RuleMatrix_grahaName(antar_12);
    return toText(printf("Intellect and commerce peak, ages %.1f to %.1f: a Forked Head line over an elevated Budha mount (Samudrika) meets the Budha maha-dasha with the %s antar-dasha (Parashara). Trade, writing and negotiation succeed in this exact span; scattered ventures outside it do not carry the same sanction."))(a0_4)(a1_4)(arg_19);
}), new CrossReferenceRule(new RuleId(5, []), (m_13) => RuleMatrix_allOf(ofArray([(m_11) => RuleMatrix_lineIs(new PrimaryLine(2, []), new LineState(0, []), m_11), (m_12) => RuleMatrix_mountIs(new MountName(2, []), new MountProminence(0, []), m_12)]), m_13), (arg10$0040_4, maha_13, antar_14) => RuleMatrix_dashaOnly((maha_12, antar_13) => {
    if (equals(maha_12, new Graha(2, []))) {
        if (equals(antar_13, new Graha(2, [])) ? true : equals(antar_13, new Graha(3, []))) {
            return true;
        }
        else {
            return equals(antar_13, new Graha(6, []));
        }
    }
    else {
        return false;
    }
}, arg10$0040_4, maha_13, antar_14), (_arg_7, _arg_8, antar_15, a0_5, a1_5) => {
    const arg_22 = RuleMatrix_grahaName(antar_15);
    return toText(printf("Vitality and sovereignty window, ages %.1f to %.1f: a Deep Life line beneath an elevated Surya mount (Samudrika) meets the Surya maha-dasha with the %s antar-dasha (Parashara). Health, confidence and visible leadership crest together in exactly this span."))(a0_5)(a1_5)(arg_22);
})]);

export const RuleMatrix_minimumAlignedSystems = 2;

function RuleMatrix_systemOf(witness) {
    switch (witness.tag) {
        case 2:
            return new KnowledgeSystem(3, []);
        case 3:
            return new KnowledgeSystem(0, []);
        case 4:
            return new KnowledgeSystem(1, []);
        default:
            return new KnowledgeSystem(2, []);
    }
}

/**
 * Runs every rule against every (maha, antar) window of the timeline.
 * Purely a fold over immutable data: same inputs, same events, always.
 */
export function RuleMatrix_run(evaluationInstant, metrics, ctx, timeline) {
    const birth = metrics.BirthData.UtcBirthInstant;
    return toList(delay(() => collect((rule) => {
        const matchValue = rule.StructuralGate(metrics);
        if (matchValue != null) {
            const structuralWitnesses = matchValue;
            return collect((maha) => collect((antar) => {
                const matchValue_1 = rule.TemporalGate(ctx, maha.MahaLord, antar.AntarLord);
                if (matchValue_1 != null) {
                    const witnesses = append(matchValue_1, structuralWitnesses);
                    const systems = List_distinct(map_1(RuleMatrix_systemOf, witnesses), {
                        Equals: equals,
                        GetHashCode: (x) => (safeHash(x) | 0),
                    });
                    if (length(systems) >= RuleMatrix_minimumAlignedSystems) {
                        const a0 = Vimshottari_ageInYearsAt(birth, antar.AntarPeriod.RangeStart);
                        const a1 = Vimshottari_ageInYearsAt(birth, antar.AntarPeriod.RangeEnd);
                        return singleton_1(new TimelineEvent((compare_1(antar.AntarPeriod.RangeEnd, evaluationInstant) <= 0) ? (new TimelineType(0, [])) : (new TimelineType(1, [])), rule.Id, antar.AntarPeriod, map((p) => p.PratyantarPeriod, tryHead(antar.Pratyantars)), [a0, a1], witnesses, systems, rule.Reading(ctx, maha.MahaLord, antar.AntarLord, a0, a1), defaultArg(tryFind(rule.Id, ClassicalSources_references), empty())));
                    }
                    else {
                        return empty_1();
                    }
                }
                else {
                    return empty_1();
                }
            }, maha.Antars), timeline);
        }
        else {
            return empty_1();
        }
    }, RuleMatrix_rules)));
}

