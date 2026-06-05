import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Observation from '../models/Observation.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit.js';
import { detectObservationAnomalies } from '../services/dataQuality.js';

const router = Router();
router.use(authenticate);

const paginate = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, parseInt(req.query.limit) || 20);
  return { page, limit, skip: (page - 1) * limit };
};

// GET /api/v1/observations
router.get('/', authorize('observations:read'), async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req);
    const filter = { organization: req.orgId };
    if (req.query.patient) filter.patient = req.query.patient;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.code) filter['code.code'] = req.query.code;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from) filter.effectiveDateTime = { $gte: new Date(req.query.from) };
    if (req.query.to) {
      filter.effectiveDateTime = { ...(filter.effectiveDateTime || {}), $lte: new Date(req.query.to) };
    }

    const [data, total] = await Promise.all([
      Observation.find(filter).sort({ effectiveDateTime: -1 }).skip(skip).limit(limit).lean(),
      Observation.countDocuments(filter)
    ]);
    res.json({ data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/observations/:id
router.get('/:id', authorize('observations:read'), async (req, res) => {
  try {
    const obs = await Observation.findOne({ _id: req.params.id, organization: req.orgId }).lean();
    if (!obs) return res.status(404).json({ error: 'Observation not found' });
    res.json({ data: obs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/observations
router.post('/', authorize('observations:write'), auditLog('CREATE', 'Observation'), [
  body('patient').notEmpty(),
  body('code.code').notEmpty(),
  body('effectiveDateTime').isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const anomalies = detectObservationAnomalies(req.body);
    const obs = await Observation.create({ ...req.body, organization: req.orgId });
    res.status(201).json({ data: obs, anomalies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/observations/bulk  — bulk create (lab results import)
router.post('/bulk', authorize('observations:write'), async (req, res) => {
  try {
    const { observations } = req.body;
    if (!Array.isArray(observations) || !observations.length) {
      return res.status(400).json({ error: 'observations array required' });
    }
    if (observations.length > 5000) return res.status(400).json({ error: 'Max 5000 per batch' });

    const withOrg = observations.map(o => ({ ...o, organization: req.orgId }));
    const anomalyCount = withOrg.reduce((n, o) => n + detectObservationAnomalies(o).length, 0);
    const result = await Observation.insertMany(withOrg, { ordered: false });

    res.json({ data: { created: result.length, anomaliesDetected: anomalyCount } });
  } catch (err) {
    if (err.insertedDocs) {
      return res.json({ data: { created: err.insertedDocs.length, errors: err.writeErrors?.length } });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
