import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Encounter from '../models/Encounter.js';
import Patient from '../models/Patient.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

const paginate = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  return { page, limit, skip: (page - 1) * limit };
};

// GET /api/v1/encounters
router.get('/', authorize('encounters:read'), async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req);
    const filter = { organization: req.orgId };
    if (req.query.patient) filter.patient = req.query.patient;
    if (req.query.provider) filter.provider = req.query.provider;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.class) filter['class.code'] = req.query.class;
    if (req.query.from) filter['period.start'] = { $gte: new Date(req.query.from) };
    if (req.query.to) {
      filter['period.start'] = { ...(filter['period.start'] || {}), $lte: new Date(req.query.to) };
    }

    const [data, total] = await Promise.all([
      Encounter.find(filter)
        .populate('patient', 'name birthDate gender')
        .populate('provider', 'name credentials')
        .sort({ 'period.start': -1 }).skip(skip).limit(limit).lean(),
      Encounter.countDocuments(filter)
    ]);

    res.json({ data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/encounters/:id
router.get('/:id', authorize('encounters:read'), async (req, res) => {
  try {
    const enc = await Encounter.findOne({ _id: req.params.id, organization: req.orgId })
      .populate('patient', 'name birthDate gender')
      .populate('provider', 'name credentials specialty')
      .populate('diagnosis.condition').lean();
    if (!enc) return res.status(404).json({ error: 'Encounter not found' });
    res.json({ data: enc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/encounters
router.post('/', authorize('encounters:write'), auditLog('CREATE', 'Encounter'), [
  body('patient').notEmpty(),
  body('period.start').isISO8601()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const enc = await Encounter.create({ ...req.body, organization: req.orgId });

    // Update lastEncounterDate on patient
    await Patient.findByIdAndUpdate(req.body.patient, {
      $max: { lastEncounterDate: new Date(req.body.period.start) }
    });

    res.status(201).json({ data: enc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/encounters/:id
router.put('/:id', authorize('encounters:write'), auditLog('UPDATE', 'Encounter'), async (req, res) => {
  try {
    const enc = await Encounter.findOneAndUpdate(
      { _id: req.params.id, organization: req.orgId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!enc) return res.status(404).json({ error: 'Encounter not found' });
    res.json({ data: enc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
