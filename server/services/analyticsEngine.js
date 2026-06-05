/**
 * Population health analytics engine.
 * Risk stratification, care-gap analysis, cohort analytics.
 */
import Patient from '../models/Patient.js';
import Condition from '../models/Condition.js';
import Observation from '../models/Observation.js';
import MedicationRequest from '../models/MedicationRequest.js';
import Encounter from '../models/Encounter.js';

// Charlson Comorbidity Index weights mapped to ICD-10 prefixes
const CCI_WEIGHTS = {
  'I21': 1, 'I22': 1,  // MI
  'I50': 1,             // CHF
  'I70': 1, 'I71': 1,  // PVD
  'I60': 1, 'I61': 1, 'I62': 1, 'I63': 1, 'I64': 1, // Stroke
  'F00': 1, 'F01': 1, 'F02': 1, 'F03': 1, // Dementia
  'J44': 1, 'J43': 1, // COPD
  'M05': 1, 'M06': 1, // Rheum disease
  'K74': 1,            // Mild liver disease
  'E10': 1, 'E11': 1, // DM without complications
  'E12': 2, 'E13': 2, 'E14': 2, // DM with complications
  'I12': 2, 'I13': 2, 'N18': 2, // Renal disease
  'C': 2,              // Any malignancy (prefix)
  'K72': 3, 'K76': 3, // Moderate/severe liver disease
  'C77': 6, 'C78': 6, 'C79': 6, 'C80': 6, // Metastatic solid tumor
  'B20': 6, 'B21': 6, 'B22': 6, 'B24': 6  // AIDS
};

// Care gap definitions: preventive measures and their criteria
const CARE_GAPS = [
  {
    id: 'diabetes_a1c',
    name: 'Diabetes A1C Testing',
    description: 'Patients with diabetes should have A1C tested every 3 months',
    loincCodes: ['4548-4', '17856-6'],
    conditionCodes: ['E11', 'E10', 'E12', 'E13', 'E14'],
    maxMonths: 3,
    ageMin: 18
  },
  {
    id: 'hypertension_bp',
    name: 'Hypertension Blood Pressure Control',
    description: 'Hypertensive patients need BP check every 6 months',
    loincCodes: ['55284-4', '8480-6'],
    conditionCodes: ['I10', 'I11', 'I12', 'I13'],
    maxMonths: 6,
    ageMin: 18
  },
  {
    id: 'annual_wellness',
    name: 'Annual Wellness Visit',
    description: 'All patients should have an annual wellness visit',
    encounterTypes: ['WELLNESS', 'AWV', '99381', '99382', '99383', '99384', '99385'],
    maxMonths: 12,
    ageMin: 0
  },
  {
    id: 'mammography',
    name: 'Breast Cancer Screening',
    description: 'Women 50-74 should have mammography every 2 years',
    loincCodes: ['24606-6', '26346-7'],
    gender: 'female',
    ageMin: 50, ageMax: 74,
    maxMonths: 24
  },
  {
    id: 'colorectal_screening',
    name: 'Colorectal Cancer Screening',
    description: 'Adults 45-75 should have colorectal screening',
    loincCodes: ['80372-6', '27396-1'],
    ageMin: 45, ageMax: 75,
    maxMonths: 12
  },
  {
    id: 'flu_vaccine',
    name: 'Annual Flu Vaccination',
    description: 'All patients should receive annual flu vaccine',
    loincCodes: ['160701000000100'],
    maxMonths: 12,
    ageMin: 6
  }
];

export const computeRiskScore = async (patientId, orgId) => {
  const [conditions, observations, medications, encounters] = await Promise.all([
    Condition.find({ patient: patientId, organization: orgId, clinicalStatus: 'active' }).lean(),
    Observation.find({ patient: patientId, organization: orgId, status: 'final' })
      .sort({ effectiveDateTime: -1 }).limit(50).lean(),
    MedicationRequest.find({ patient: patientId, organization: orgId, status: 'active' }).lean(),
    Encounter.find({ patient: patientId, organization: orgId })
      .sort({ 'period.start': -1 }).limit(12).lean()
  ]);
  const patient = await Patient.findById(patientId).lean();

  let score = 0;
  const factors = [];

  // Age-based risk
  if (patient?.birthDate) {
    const age = Math.floor((Date.now() - new Date(patient.birthDate)) / (365.25 * 86400000));
    if (age >= 65) { score += 15; factors.push('Age 65+'); }
    else if (age >= 50) { score += 8; factors.push('Age 50-64'); }
    else if (age >= 40) { score += 4; }
  }

  // CCI-based comorbidity scoring
  let cciScore = 0;
  for (const cond of conditions) {
    const prefix3 = cond.code?.code?.substring(0, 3);
    const prefix2 = cond.code?.code?.substring(0, 2);
    const weight = CCI_WEIGHTS[cond.code?.code] || CCI_WEIGHTS[prefix3] || CCI_WEIGHTS[prefix2] || 0;
    cciScore += weight;
  }
  const cciRiskPoints = Math.min(cciScore * 5, 30);
  score += cciRiskPoints;
  if (cciScore >= 3) factors.push(`High comorbidity burden (CCI: ${cciScore})`);

  // Medication complexity
  if (medications.length >= 10) { score += 10; factors.push('Polypharmacy (10+ medications)'); }
  else if (medications.length >= 5) { score += 5; factors.push('Multiple medications (5-9)'); }

  // High ED/inpatient utilization
  const last90days = new Date(Date.now() - 90 * 86400000);
  const edVisits = encounters.filter(e =>
    e.class?.code === 'EMER' && new Date(e.period?.start) > last90days
  ).length;
  if (edVisits >= 3) { score += 15; factors.push(`High ED utilization (${edVisits} visits in 90 days)`); }
  else if (edVisits >= 1) { score += 7; }

  const inpatientVisits = encounters.filter(e => e.class?.code === 'IMP').length;
  if (inpatientVisits >= 2) { score += 10; factors.push(`Recent hospitalizations (${inpatientVisits})`); }

  // Uncontrolled vitals
  const latestBP = observations.find(o => o.code?.code === '55284-4');
  if (latestBP?.value?.quantity?.value > 160) {
    score += 8; factors.push('Uncontrolled hypertension (SBP > 160)');
  }

  const latestA1c = observations.find(o => ['4548-4', '17856-6'].includes(o.code?.code));
  if (latestA1c?.value?.quantity?.value > 9) {
    score += 8; factors.push('Uncontrolled diabetes (A1C > 9%)');
  }

  const clampedScore = Math.min(100, score);
  let category = 'low';
  if (clampedScore >= 60) category = 'very_high';
  else if (clampedScore >= 40) category = 'high';
  else if (clampedScore >= 20) category = 'medium';

  return { value: clampedScore, category, factors, lastCalculated: new Date() };
};

export const identifyCareGaps = async (patientId, orgId) => {
  const patient = await Patient.findById(patientId).lean();
  if (!patient) return [];

  const age = patient.birthDate
    ? Math.floor((Date.now() - new Date(patient.birthDate)) / (365.25 * 86400000))
    : null;

  const conditions = await Condition.find({ patient: patientId, organization: orgId, clinicalStatus: 'active' }).lean();
  const conditionCodes = conditions.map(c => c.code?.code?.substring(0, 3));

  const gaps = [];

  for (const gap of CARE_GAPS) {
    // Age filter
    if (age !== null) {
      if (gap.ageMin && age < gap.ageMin) continue;
      if (gap.ageMax && age > gap.ageMax) continue;
    }
    // Gender filter
    if (gap.gender && patient.gender !== gap.gender) continue;

    // Condition filter: gap only applies if patient has relevant condition
    if (gap.conditionCodes?.length) {
      const hasCondition = gap.conditionCodes.some(cc =>
        conditionCodes.some(pc => pc.startsWith(cc.substring(0, 3)))
      );
      if (!hasCondition) continue;
    }

    // Check if gap is closed (recent observation/encounter)
    const cutoff = new Date(Date.now() - gap.maxMonths * 30 * 86400000);
    let gapClosed = false;

    if (gap.loincCodes) {
      const recent = await Observation.findOne({
        patient: patientId,
        organization: orgId,
        'code.code': { $in: gap.loincCodes },
        effectiveDateTime: { $gte: cutoff },
        status: { $in: ['final', 'amended', 'corrected'] }
      }).lean();
      gapClosed = !!recent;
    } else if (gap.encounterTypes) {
      const recent = await Encounter.findOne({
        patient: patientId,
        organization: orgId,
        'period.start': { $gte: cutoff },
        status: 'finished'
      }).lean();
      gapClosed = !!recent;
    }

    gaps.push({
      id: gap.id,
      name: gap.name,
      description: gap.description,
      status: gapClosed ? 'closed' : 'open',
      priority: gapClosed ? 'low' : (age >= 65 ? 'high' : 'medium'),
      dueBy: gapClosed ? null : new Date(Date.now() + 30 * 86400000)
    });
  }

  return gaps;
};

export const getPopulationHealthSummary = async (orgId) => {
  const [totalPatients, activeConditions, recentEncounters] = await Promise.all([
    Patient.countDocuments({ organization: orgId, isDeleted: false, active: true }),
    Condition.aggregate([
      { $match: { organization: orgId, clinicalStatus: 'active' } },
      { $group: { _id: { $substr: ['$code.code', 0, 3] }, count: { $sum: 1 }, display: { $first: '$code.display' } } },
      { $sort: { count: -1 } }, { $limit: 10 }
    ]),
    Encounter.countDocuments({
      organization: orgId,
      'period.start': { $gte: new Date(Date.now() - 30 * 86400000) }
    })
  ]);

  const riskDistribution = await Patient.aggregate([
    { $match: { organization: orgId, isDeleted: false, active: true } },
    { $group: { _id: '$riskScore.category', count: { $sum: 1 } } }
  ]);

  const ageDistribution = await Patient.aggregate([
    { $match: { organization: orgId, isDeleted: false, active: true, birthDate: { $exists: true } } },
    {
      $bucket: {
        groupBy: {
          $floor: {
            $divide: [{ $subtract: [new Date(), '$birthDate'] }, 1000 * 60 * 60 * 24 * 365.25]
          }
        },
        boundaries: [0, 18, 35, 50, 65, 80, 200],
        default: 'unknown',
        output: { count: { $sum: 1 } }
      }
    }
  ]);

  return {
    totalPatients,
    recentEncounters,
    topConditions: activeConditions,
    riskDistribution: riskDistribution.reduce((acc, r) => {
      acc[r._id || 'unknown'] = r.count;
      return acc;
    }, {}),
    ageDistribution: ageDistribution.map(b => ({
      range: `${b._id}–${b._id + 17}`,
      count: b.count
    }))
  };
};

export const getRiskStratification = async (orgId, filters = {}) => {
  const match = { organization: orgId, isDeleted: false, active: true };
  if (filters.riskCategory) match['riskScore.category'] = filters.riskCategory;
  if (filters.gender) match.gender = filters.gender;

  return Patient.find(match)
    .select('fhirId name birthDate gender riskScore lastEncounterDate primaryProvider')
    .populate('primaryProvider', 'name')
    .sort({ 'riskScore.value': -1 })
    .limit(filters.limit || 100)
    .lean();
};

export const getCohortAnalysis = async (orgId, criteria) => {
  const match = { organization: orgId, isDeleted: false, active: true };

  if (criteria.ageMin || criteria.ageMax) {
    const today = new Date();
    if (criteria.ageMax) {
      match.birthDate = { $gte: new Date(today.getFullYear() - criteria.ageMax - 1, today.getMonth(), today.getDate()) };
    }
    if (criteria.ageMin) {
      match.birthDate = { ...(match.birthDate || {}), $lte: new Date(today.getFullYear() - criteria.ageMin, today.getMonth(), today.getDate()) };
    }
  }
  if (criteria.gender) match.gender = criteria.gender;
  if (criteria.riskCategory) match['riskScore.category'] = criteria.riskCategory;
  if (criteria.tags?.length) match.tags = { $in: criteria.tags };

  const patients = await Patient.find(match)
    .select('fhirId name birthDate gender riskScore insurance')
    .limit(1000).lean();

  const patientIds = patients.map(p => p._id);

  const [conditionCounts, encounterStats] = await Promise.all([
    Condition.aggregate([
      { $match: { patient: { $in: patientIds }, clinicalStatus: 'active' } },
      { $group: { _id: '$code.code', display: { $first: '$code.display' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 10 }
    ]),
    Encounter.aggregate([
      { $match: { patient: { $in: patientIds } } },
      { $group: {
        _id: '$patient',
        total: { $sum: 1 },
        edVisits: { $sum: { $cond: [{ $eq: ['$class.code', 'EMER'] }, 1, 0] } },
        inpatient: { $sum: { $cond: [{ $eq: ['$class.code', 'IMP'] }, 1, 0] } }
      }}
    ])
  ]);

  const avgEncounters = encounterStats.reduce((sum, e) => sum + e.total, 0) / (encounterStats.length || 1);
  const avgEdVisits = encounterStats.reduce((sum, e) => sum + e.edVisits, 0) / (encounterStats.length || 1);

  return {
    cohortSize: patients.length,
    criteria,
    topConditions: conditionCounts,
    utilizationAvg: {
      totalEncounters: Math.round(avgEncounters * 10) / 10,
      edVisits: Math.round(avgEdVisits * 10) / 10
    },
    riskDistribution: patients.reduce((acc, p) => {
      const cat = p.riskScore?.category || 'unknown';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {})
  };
};
