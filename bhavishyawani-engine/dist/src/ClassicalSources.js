
import { Union } from "../fable-library/Types.js";
import { union_type, string_type, int32_type } from "../fable-library/Reflection.js";
import { ofList } from "../fable-library/Map.js";
import { ofArray } from "../fable-library/List.js";
import { compare } from "../fable-library/Util.js";
import { printf, toText } from "../fable-library/String.js";

export class ClassicalSource extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["ParasharaHora", "GarudaPuranaSamudrika", "RigVeda", "BrihatSamhita", "SamudrikaShastra"];
    }
}

export function ClassicalSource_$reflection() {
    return union_type("Bhavishyawani.ClassicalSource", [], ClassicalSource, () => [[["chapter", int32_type], ["topic", string_type]], [["adhyaya", int32_type], ["topic", string_type]], [["mandala", int32_type], ["sukta", int32_type], ["topic", string_type]], [["chapter", int32_type], ["topic", string_type]], [["section", string_type]]]);
}

/**
 * Stable identifiers for the cross-reference rules of the prediction matrix.
 */
export class RuleId extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["MarakaWindowOnBrokenLifeLine", "DharmaKarmaAscent", "SaturnVenusRelationalStrain", "LakshmiProsperityWindow", "BuddhiCommerceWindow", "SuryaVitalityWindow"];
    }
}

export function RuleId_$reflection() {
    return union_type("Bhavishyawani.RuleId", [], RuleId, () => [[], [], [], [], [], []]);
}

export const ClassicalSources_references = ofList(ofArray([[new RuleId(0, []), ofArray([new ClassicalSource(0, [44, "Maraka-adhyaya: periods critical to longevity and health"]), new ClassicalSource(4, ["Jeevan-rekha bhanga: breaks in the Life line and their timing"]), new ClassicalSource(1, [65, "Inauspicious rekha configurations"])])], [new RuleId(1, []), ofArray([new ClassicalSource(0, [46, "Dasha-phala: fruits of the Guru maha-dasha"]), new ClassicalSource(4, ["Bhagya-rekha depth and the elevated Guru parvata"]), new ClassicalSource(2, [4, 50, "Brihaspati sukta: the lord of counsel raised to eminence"])])], [new RuleId(2, []), ofArray([new ClassicalSource(0, [48, "Antar-dasha phala: Shukra within Shani, Shani within Shukra"]), new ClassicalSource(4, ["Hridaya-rekha shrinkhala: the chained Heart line"])])], [new RuleId(3, []), ofArray([new ClassicalSource(3, [68, "Purusha-lakshana: matsya, padma and shankha marks on the body"]), new ClassicalSource(1, [63, "Auspicious lakshanas and their fruits"]), new ClassicalSource(2, [7, 41, "Bhaga sukta: the apportioner of fortune invoked at dawn"]), new ClassicalSource(0, [46, "Dasha-phala: fruits of the Shukra and Guru maha-dashas"])])], [new RuleId(4, []), ofArray([new ClassicalSource(0, [46, "Dasha-phala: fruits of the Budha maha-dasha"]), new ClassicalSource(4, ["Mastaka-rekha fork over the prominent Budha parvata"])])], [new RuleId(5, []), ofArray([new ClassicalSource(0, [46, "Dasha-phala: fruits of the Surya maha-dasha"]), new ClassicalSource(4, ["Unbroken deep Jeevan-rekha with elevated Surya parvata"]), new ClassicalSource(2, [1, 50, "Surya sukta: the dispeller of weakness and disease"])])]]), {
    Compare: (x, y) => (compare(x, y) | 0),
});

/**
 * Human-readable citation for a source.
 */
export function ClassicalSources_citation(s) {
    switch (s.tag) {
        case 1:
            return toText(printf("Garuda Purana (Purvakhanda), adhyaya %d — %s"))(s.fields[0])(s.fields[1]);
        case 2:
            return toText(printf("Rig Veda %d.%d — %s"))(s.fields[0])(s.fields[1])(s.fields[2]);
        case 3:
            return toText(printf("Brihat Samhita, ch. %d — %s"))(s.fields[0])(s.fields[1]);
        case 4:
            return toText(printf("Samudrika Shastra — %s"))(s.fields[0]);
        default:
            return toText(printf("Brihat Parashara Hora Shastra, ch. %d — %s"))(s.fields[0])(s.fields[1]);
    }
}

