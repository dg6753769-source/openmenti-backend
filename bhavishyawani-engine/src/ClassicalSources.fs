namespace Bhavishyawani

// =============================================================================
// 4. TEXTUAL MAPPING TO THE CLASSICAL CORPUS
//
// Every rule in the cross-reference matrix is anchored to named passages of
// the classical literature. Chapter numbering follows the widely available
// editions noted per case; verse numbering varies between recensions, so each
// citation also carries the topic it anchors, keeping the reference honest
// and checkable rather than spuriously precise.
// =============================================================================

[<RequireQualifiedAccess>]
type ClassicalSource =
    /// Brihat Parashara Hora Shastra (R. Santhanam / Sharma editions).
    | ParasharaHora of chapter: int * topic: string
    /// Garuda Purana, Purvakhanda — Samudrika-lakshana adhyayas.
    | GarudaPuranaSamudrika of adhyaya: int * topic: string
    /// Rig Veda, cited as mandala.sukta.
    | RigVeda of mandala: int * sukta: int * topic: string
    /// Varahamihira's Brihat Samhita (M. R. Bhat edition).
    | BrihatSamhita of chapter: int * topic: string
    /// The traditional hasta-rekha (Samudrika Shastra) corpus.
    | SamudrikaShastra of section: string

/// Stable identifiers for the cross-reference rules of the prediction matrix.
[<RequireQualifiedAccess>]
type RuleId =
    | MarakaWindowOnBrokenLifeLine
    | DharmaKarmaAscent
    | SaturnVenusRelationalStrain
    | LakshmiProsperityWindow
    | BuddhiCommerceWindow
    | SuryaVitalityWindow

module ClassicalSources =

    /// Immutable lookup: rule -> canonical textual anchors.
    /// This map IS the engine's bibliography; readings cite nothing else.
    let references: Map<RuleId, ClassicalSource list> =
        Map.ofList
            [ RuleId.MarakaWindowOnBrokenLifeLine,
              [ ClassicalSource.ParasharaHora(44, "Maraka-adhyaya: periods critical to longevity and health")
                ClassicalSource.SamudrikaShastra "Jeevan-rekha bhanga: breaks in the Life line and their timing"
                ClassicalSource.GarudaPuranaSamudrika(65, "Inauspicious rekha configurations") ]

              RuleId.DharmaKarmaAscent,
              [ ClassicalSource.ParasharaHora(46, "Dasha-phala: fruits of the Guru maha-dasha")
                ClassicalSource.SamudrikaShastra "Bhagya-rekha depth and the elevated Guru parvata"
                ClassicalSource.RigVeda(4, 50, "Brihaspati sukta: the lord of counsel raised to eminence") ]

              RuleId.SaturnVenusRelationalStrain,
              [ ClassicalSource.ParasharaHora(48, "Antar-dasha phala: Shukra within Shani, Shani within Shukra")
                ClassicalSource.SamudrikaShastra "Hridaya-rekha shrinkhala: the chained Heart line" ]

              RuleId.LakshmiProsperityWindow,
              [ ClassicalSource.BrihatSamhita(68, "Purusha-lakshana: matsya, padma and shankha marks on the body")
                ClassicalSource.GarudaPuranaSamudrika(63, "Auspicious lakshanas and their fruits")
                ClassicalSource.RigVeda(7, 41, "Bhaga sukta: the apportioner of fortune invoked at dawn")
                ClassicalSource.ParasharaHora(46, "Dasha-phala: fruits of the Shukra and Guru maha-dashas") ]

              RuleId.BuddhiCommerceWindow,
              [ ClassicalSource.ParasharaHora(46, "Dasha-phala: fruits of the Budha maha-dasha")
                ClassicalSource.SamudrikaShastra "Mastaka-rekha fork over the prominent Budha parvata" ]

              RuleId.SuryaVitalityWindow,
              [ ClassicalSource.ParasharaHora(46, "Dasha-phala: fruits of the Surya maha-dasha")
                ClassicalSource.SamudrikaShastra "Unbroken deep Jeevan-rekha with elevated Surya parvata"
                ClassicalSource.RigVeda(1, 50, "Surya sukta: the dispeller of weakness and disease") ] ]

    /// Human-readable citation for a source.
    let citation (s: ClassicalSource) =
        match s with
        | ClassicalSource.ParasharaHora (ch, topic) ->
            sprintf "Brihat Parashara Hora Shastra, ch. %d — %s" ch topic
        | ClassicalSource.GarudaPuranaSamudrika (adhyaya, topic) ->
            sprintf "Garuda Purana (Purvakhanda), adhyaya %d — %s" adhyaya topic
        | ClassicalSource.RigVeda (mandala, sukta, topic) ->
            sprintf "Rig Veda %d.%d — %s" mandala sukta topic
        | ClassicalSource.BrihatSamhita (ch, topic) ->
            sprintf "Brihat Samhita, ch. %d — %s" ch topic
        | ClassicalSource.SamudrikaShastra section ->
            sprintf "Samudrika Shastra — %s" section
