/**
 * AI-assisted data quality engine.
 * Scores patient records 0-100 and surfaces specific flags.
 */

// Vital-signs reference ranges for anomaly detection
const VITAL_RANGES = {
  '8310-5':  { min: 35, max: 42, unit: '°C' },       // Body temperature
  '8867-4':  { min: 20, max: 300, unit: '/min' },     // Heart rate
  '9279-1':  { min: 4, max: 60, unit: '/min' },       // Respiratory rate
  '55284-4': { min: 50, max: 300, unit: 'mmHg' },     // Systolic BP
  '8462-4':  { min: 20, max: 200, unit: 'mmHg' },     // Diastolic BP
  '2339-0':  { min: 0, max: 1000, unit: 'mg/dL' },   // Blood glucose
  '2708-6':  { min: 50, max: 100, unit: '%' },        // O2 saturation
  '29463-7': { min: 0.5, max: 700, unit: 'kg' },      // Body weight
  '8302-2':  { min: 50, max: 250, unit: 'cm' },       // Body height
};

const CHRONIC_CONDITION_CODES = new Set([
  'E11', 'E10', 'I10', 'I50', 'J44', 'N18', 'I25', 'F32',
  'M79', 'K57', 'E78', 'I48', 'G47', 'E66'
]);

export const scorePatient = (patient) => {
  let score = 0;
  const flags = [];

  // --- Demographic completeness (40 pts) ---
  if (patient.name?.length && patient.name[0]?.family && patient.name[0]?.given?.length) {
    score += 10;
  } else {
    flags.push({ field: 'name', issue: 'Missing or incomplete name', severity: 'error' });
  }

  if (patient.birthDate) {
    score += 10;
    const dob = new Date(patient.birthDate);
    if (dob > new Date()) {
      flags.push({ field: 'birthDate', issue: 'Birth date is in the future', severity: 'error' });
      score -= 10;
    }
    if (dob < new Date('1900-01-01')) {
      flags.push({ field: 'birthDate', issue: 'Birth date before 1900', severity: 'warning' });
    }
  } else {
    flags.push({ field: 'birthDate', issue: 'Missing date of birth', severity: 'error' });
  }

  if (patient.gender && patient.gender !== 'unknown') {
    score += 5;
  } else {
    flags.push({ field: 'gender', issue: 'Gender not specified', severity: 'warning' });
  }

  if (patient.address?.length && patient.address[0]?.city) {
    score += 5;
  } else {
    flags.push({ field: 'address', issue: 'Missing address', severity: 'warning' });
  }

  // --- Contact info (15 pts) ---
  const phone = patient.telecom?.find(t => t.system === 'phone' && t.value);
  const email = patient.telecom?.find(t => t.system === 'email' && t.value);
  if (phone) {
    score += 8;
    if (!/^\+?[\d\s\-().]{7,15}$/.test(phone.value)) {
      flags.push({ field: 'telecom.phone', issue: 'Phone number format invalid', severity: 'warning' });
      score -= 3;
    }
  } else {
    flags.push({ field: 'telecom.phone', issue: 'No phone number on file', severity: 'warning' });
  }
  if (email) {
    score += 7;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      flags.push({ field: 'telecom.email', issue: 'Email format invalid', severity: 'warning' });
      score -= 3;
    }
  } else {
    flags.push({ field: 'telecom.email', issue: 'No email on file', severity: 'info' });
  }

  // --- Identifiers (10 pts) ---
  if (patient.identifiers?.length) {
    score += 10;
  } else {
    flags.push({ field: 'identifiers', issue: 'No patient identifiers (MRN etc.)', severity: 'error' });
  }

  // --- Insurance (15 pts) ---
  if (patient.insurance?.length) {
    score += 10;
    const primary = patient.insurance.find(i => i.isPrimary);
    if (primary?.terminationDate && new Date(primary.terminationDate) < new Date()) {
      flags.push({ field: 'insurance', issue: 'Primary insurance appears expired', severity: 'warning' });
      score -= 5;
    }
    if (!primary) {
      score += 5;
    }
  } else {
    flags.push({ field: 'insurance', issue: 'No insurance information', severity: 'info' });
  }

  // --- Provider assignment (10 pts) ---
  if (patient.primaryProvider) score += 10;
  else flags.push({ field: 'primaryProvider', issue: 'No primary care provider assigned', severity: 'info' });

  // --- Language (5 pts) ---
  if (patient.language && patient.language !== 'unknown') score += 5;

  // --- Race/ethnicity (5 pts) ---
  if (patient.race) score += 3;
  if (patient.ethnicity) score += 2;

  return {
    score: Math.max(0, Math.min(100, score)),
    flags
  };
};

export const detectObservationAnomalies = (observation) => {
  const flags = [];
  const loincCode = observation.code?.code;
  const range = VITAL_RANGES[loincCode];
  if (!range || !observation.value?.quantity?.value) return flags;

  const val = observation.value.quantity.value;
  if (val < range.min || val > range.max) {
    flags.push({
      field: 'value',
      issue: `Value ${val} ${range.unit} is outside physiologically plausible range (${range.min}–${range.max})`,
      severity: val < range.min * 0.5 || val > range.max * 1.5 ? 'error' : 'warning'
    });
  }
  return flags;
};

export const findDuplicateCandidates = async (patient, PatientModel) => {
  const name = patient.name?.find(n => n.use === 'official') || patient.name?.[0];
  if (!name?.family || !patient.birthDate) return [];

  const candidates = await PatientModel.find({
    organization: patient.organization,
    'name.family': { $regex: new RegExp(`^${name.family}$`, 'i') },
    birthDate: {
      $gte: new Date(new Date(patient.birthDate).getTime() - 24 * 3600 * 1000),
      $lte: new Date(new Date(patient.birthDate).getTime() + 24 * 3600 * 1000)
    },
    _id: { $ne: patient._id },
    isDeleted: false
  }).limit(5).lean();

  return candidates.map(c => ({
    patientId: c._id,
    fhirId: c.fhirId,
    name: [c.name?.[0]?.given?.join(' '), c.name?.[0]?.family].filter(Boolean).join(' '),
    birthDate: c.birthDate,
    matchScore: computeMatchScore(patient, c)
  }));
};

const computeMatchScore = (a, b) => {
  let score = 0;
  const nameA = a.name?.[0]; const nameB = b.name?.[0];
  if (nameA?.family?.toLowerCase() === nameB?.family?.toLowerCase()) score += 40;
  if (nameA?.given?.[0]?.toLowerCase() === nameB?.given?.[0]?.toLowerCase()) score += 20;
  if (a.birthDate && b.birthDate &&
      new Date(a.birthDate).toDateString() === new Date(b.birthDate).toDateString()) score += 30;
  if (a.gender === b.gender) score += 10;
  return score;
};

export const computeOrganizationQualityReport = async (orgId, PatientModel) => {
  const patients = await PatientModel.find({ organization: orgId, isDeleted: false }).limit(1000).lean();
  if (!patients.length) return { score: 0, totalPatients: 0, breakdown: {} };

  let totalScore = 0;
  const breakdown = {
    completeName: 0, hasDOB: 0, hasGender: 0,
    hasPhone: 0, hasAddress: 0, hasInsurance: 0, hasIdentifier: 0
  };

  for (const p of patients) {
    const { score } = scorePatient(p);
    totalScore += score;
    if (p.name?.[0]?.family) breakdown.completeName++;
    if (p.birthDate) breakdown.hasDOB++;
    if (p.gender && p.gender !== 'unknown') breakdown.hasGender++;
    if (p.telecom?.some(t => t.system === 'phone')) breakdown.hasPhone++;
    if (p.address?.length) breakdown.hasAddress++;
    if (p.insurance?.length) breakdown.hasInsurance++;
    if (p.identifiers?.length) breakdown.hasIdentifier++;
  }

  const total = patients.length;
  return {
    score: Math.round(totalScore / total),
    totalPatients: total,
    breakdown: Object.fromEntries(
      Object.entries(breakdown).map(([k, v]) => [k, { count: v, pct: Math.round(v / total * 100) }])
    )
  };
};

export const isChronicCondition = (icd10Code) => {
  const prefix = icd10Code?.substring(0, 3);
  return CHRONIC_CONDITION_CODES.has(prefix);
};
