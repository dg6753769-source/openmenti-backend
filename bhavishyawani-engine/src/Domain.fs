namespace Bhavishyawani

open System

// =============================================================================
// 1. THE MULTI-PARAM INPUT DOMAIN
//
// Every observable the engine consumes is modelled as a closed, finite type.
// There is no free-form "notes" string anywhere in the input domain: if an
// observation cannot be expressed in these types, the engine cannot (and must
// not) reason about it. This is the first line of the "Zero Bluffing" policy.
// =============================================================================

/// Geographic coordinates of the birth place, WGS84 decimal degrees.
type GeoCoordinates =
    { /// Degrees north of the equator. Valid range [-90.0, +90.0].
      Latitude: float
      /// Degrees east of Greenwich. Valid range [-180.0, +180.0].
      Longitude: float }

/// The exact birth instant. The caller MUST convert the local birth time to
/// UTC before constructing this record — the engine performs no timezone
/// guessing, because a guessed timezone is a bluffed nakshatra.
type BirthData =
    { UtcBirthInstant: DateTime
      Coordinates: GeoCoordinates }

// ---------------------------------------------------------------------------
// Samudrika Shastra: the palm (hasta-rekha)
// ---------------------------------------------------------------------------

/// The four primary rekhas read by classical hasta-samudrika.
[<RequireQualifiedAccess>]
type PrimaryLine =
    | HeartLine // Hridaya rekha
    | HeadLine  // Mastaka rekha
    | LifeLine  // Jeevan rekha
    | FateLine  // Bhagya rekha

/// The structural state of a rekha. Exactly one state per observed line;
/// an unobserved line is simply absent from the map (never "unknown-ish").
[<RequireQualifiedAccess>]
type LineState =
    | Deep
    | Chained
    | Broken
    | Forked

/// The four mounts (parvata) cross-referenced by this engine.
[<RequireQualifiedAccess>]
type MountName =
    | Jupiter // Guru parvata
    | Saturn  // Shani parvata
    | Sun     // Surya parvata
    | Mercury // Budha parvata

[<RequireQualifiedAccess>]
type MountProminence =
    | High
    | Flat
    | Depressed

type PalmMetrics =
    { /// Observed state of each primary line. A line absent from the map was
      /// not observed and contributes nothing — the engine never fabricates.
      Lines: Map<PrimaryLine, LineState>
      /// Observed prominence of each mount. Same absence semantics.
      Mounts: Map<MountName, MountProminence> }

// ---------------------------------------------------------------------------
// Samudrika Shastra: structural body signs (deha-lakshana)
// ---------------------------------------------------------------------------

/// The auspicious markings catalogued by the Samudrika corpus
/// (Garuda Purana, Purvakhanda; Brihat Samhita, Purusha-lakshana).
[<RequireQualifiedAccess>]
type AuspiciousMarking =
    | Lotus   // Padma
    | Fish    // Matsya
    | Trident // Trishula
    | Conch   // Shankha
    | Temple  // Mandira

/// A marking is only meaningful at a specific location; the pair is atomic.
type PhysicalSign =
    { Marking: AuspiciousMarking
      Location: MountName }

// ---------------------------------------------------------------------------
// Top-level input
// ---------------------------------------------------------------------------

type UserMetrics =
    { BirthData: BirthData
      PalmMetrics: PalmMetrics
      /// Structural signs are genuinely optional observations.
      PhysicalSigns: PhysicalSign list option }

// ---------------------------------------------------------------------------
// Shared temporal primitives
// ---------------------------------------------------------------------------

/// A half-open interval of real time: [RangeStart, RangeEnd).
type DateRange =
    { RangeStart: DateTime
      RangeEnd: DateTime }

/// Every emitted event is either a check against the native's past (trust
/// establishment) or a forward projection. Never both, never neither.
[<RequireQualifiedAccess>]
type TimelineType =
    | PastVerification
    | FuturePrediction
