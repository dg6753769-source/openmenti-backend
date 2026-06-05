import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import Patient from '../models/Patient.js';
import Encounter from '../models/Encounter.js';
import Observation from '../models/Observation.js';
import Condition from '../models/Condition.js';
import MedicationRequest from '../models/MedicationRequest.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit.js';
import { scorePatient, findDuplicateCandidates } from '../services/dataQuality.js';
import { computeRiskScore, identifyCareGaps } from '../services/analyticsEngine.js';
import { emitHighRiskAlert } from '../services/alertService.js';

const router = Router();
router.use(authenticate);

const paginate = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  return { page, limit, skip: (page - 1) * limit };
};

// GET /api/v1/patients  — search + list
router.get('/', authorize('patients:read'), auditLog('SEARCH', 'Patient'), async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req);
    const filter = { organization: req.orgId, isDeleted: false };

    if (req.query.search) {
      const s = req.query.search.trim();
      filter.$or = [
        { 'name.family': { $regex: s, $options: 'i' } },
        { 'name.given': { $regex: s, $options: 'i' } },
        { 'identifiers.value': { $regex: s, $options: 'i' } }
      ];
    }
    if (req.query.gender) filter.gender = req.query.gender;
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';
    if (req.query.riskCategory) filter['riskScore.category'] = req.query.riskCategory;
    if (req.query.tag) filter.tags = req.query.tag;

    const [data, total] = await Promise.all([
      Patient.find(filter)
        .populate('primaryProvider', 'name credentials')
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit).lean({ virtuals: true }),
      Patient.countDocuments(filter)
    ]);

    res.json({ data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/patients/:id
router.get('/:id', authorize('patients:read'), auditLog('READ', 'Patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ _id: req.params.id, organization: req.orgId, isDeleted: false })
      .populate('primaryProvider', 'name credentials specialty')
      .populate('careTeam', 'name credentials specialty')
      .populate('dataSource', 'name type')
      .lean({ virtuals: true });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json({ data: patient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/patients/:id/360  — full patient 360 view
router.get('/:id/360', authorize('patients:read'), async (req, res) => {
  try {
    const orgId = req.orgId;
    const patientId = req.params.id;

    const patient = await Patient.findOne({ _id: patientId, organization: orgId, isDeleted: false })
      .populate('primaryProvider', 'name credentials specialty')
      .lean({ virtuals: true });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const [encounters, conditions, observations, medications, careGaps] = await Promise.all([
      Encounter.find({ patient: patientId, organization: orgId })
        .populate('provider', 'name').sort({ 'period.start': -1 }).limit(10).lean(),
      Condition.find({ patient: patientId, organization: orgId, clinicalStatus: 'active' }).lean(),
      Observation.find({ patient: patientId, organization: orgId, status: 'final' })
        .sort({ effectiveDateTime: -1 }).limit(20).lean(),
      MedicationRequest.find({ patient: patientId, organization: orgId, status: 'active' }).lean(),
      identifyCareGaps(patientId, orgId)
    ]);

    res.json({
      data: {
        patient,
        clinical: { encounters, conditions, observations, medications },
        careGaps,
        openCareGaps: careGaps.filter(g => g.status === 'open').length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/patients/:id/timeline
router.get('/:id/timeline', authorize('patients:read'), async (req, res) => {
  try {
    const patientId = req.params.id;
    const orgId = req.orgId;

    const [encounters, observations, conditions, medications] = await Promise.all([
      Encounter.find({ patient: patientId, organization: orgId }).sort({ 'period.start': -1 }).limit(20).lean(),
      Observation.find({ patient: patientId, organization: orgId }).sort({ effectiveDateTime: -1 }).limit(30).lean(),
      Condition.find({ patient: patientId, organization: orgId }).sort({ onsetDate: -1 }).lean(),
      MedicationRequest.find({ patient: patientId, organization: orgId }).sort({ authoredOn: -1 }).lean()
    ]);

    const events = [
      ...encounters.map(e => ({ type: 'encounter', date: e.period?.start, data: e })),
      ...observations.map(o => ({ type: 'observation', date: o.effectiveDateTime, data: o })),
      ...conditions.map(c => ({ type: 'condition', date: c.onsetDate || c.recordedDate, data: c })),
      ...medications.map(m => ({ type: 'medication', date: m.authoredOn, data: m }))
    ].filter(e => e.date).sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ data: events });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/patients/:id/care-gaps
router.get('/:id/care-gaps', authorize('patients:read'), async (req, res) => {
  try {
    const gaps = await identifyCareGaps(req.params.id, req.orgId);
    res.json({ data: gaps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/patients  — create patient
router.post('/', authorize('patients:write'), auditLog('CREATE', 'Patient'), [
  body('name').isArray({ min: 1 }),
  body('name.*.family').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const data = { ...req.body, organization: req.orgId };
    const { score, flags } = scorePatient(data);
    data.qualityScore = score;
    data.qualityFlags = flags;

    const patient = await Patient.create(data);
    await patient.populate('primaryProvider', 'name');

    // Compute initial risk in background
    computeRiskScore(patient._id, req.orgId).then(async (risk) => {
      await Patient.findByIdAndUpdate(patient._id, { riskScore: risk });
      if (risk.category === 'high' || risk.category === 'very_high') {
        emitHighRiskAlert(req.orgId.toString(), { ...patient.toObject(), riskScore: risk });
      }
    }).catch(console.error);

    res.status(201).json({ data: patient });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Duplicate patient record' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/patients/:id
router.put('/:id', authorize('patients:write'), auditLog('UPDATE', 'Patient'), async (req, res) => {
  try {
    const { score, flags } = scorePatient({ ...req.body, organization: req.orgId });
    req.body.qualityScore = score;
    req.body.qualityFlags = flags;

    const patient = await Patient.findOneAndUpdate(
      { _id: req.params.id, organization: req.orgId, isDeleted: false },
      req.body,
      { new: true, runValidators: true }
    ).lean({ virtuals: true });

    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json({ data: patient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/patients/:id  — soft delete
router.delete('/:id', authorize('patients:delete'), auditLog('DELETE', 'Patient'), async (req, res) => {
  try {
    const patient = await Patient.findOneAndUpdate(
      { _id: req.params.id, organization: req.orgId, isDeleted: false },
      { isDeleted: true, active: false },
      { new: true }
    );
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json({ message: 'Patient deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/patients/:id/risk-score  — recalculate risk
router.post('/:id/risk-score', authorize('patients:read'), async (req, res) => {
  try {
    const risk = await computeRiskScore(req.params.id, req.orgId);
    await Patient.findByIdAndUpdate(req.params.id, { riskScore: risk });
    res.json({ data: risk });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/patients/dedupe  — find potential duplicates
router.post('/dedupe', authorize('patients:read'), async (req, res) => {
  try {
    const patient = req.body;
    const candidates = await findDuplicateCandidates({ ...patient, organization: req.orgId }, Patient);
    res.json({ data: candidates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/patients/bulk-import
router.post('/bulk-import', authorize('patients:write'), async (req, res) => {
  try {
    const { patients } = req.body;
    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({ error: 'patients array required' });
    }
    if (patients.length > 1000) return res.status(400).json({ error: 'Max 1000 per batch' });

    const enriched = patients.map(p => {
      const { score, flags } = scorePatient({ ...p, organization: req.orgId });
      return { ...p, organization: req.orgId, qualityScore: score, qualityFlags: flags };
    });

    const result = await Patient.insertMany(enriched, { ordered: false });
    res.json({
      data: { created: result.length, total: patients.length }
    });
  } catch (err) {
    if (err.writeErrors) {
      return res.json({
        data: {
          created: err.insertedDocs?.length || 0,
          errors: err.writeErrors.length,
          total: req.body.patients?.length
        }
      });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
