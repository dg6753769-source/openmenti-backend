import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import MedicationRequest from '../models/MedicationRequest.js';
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

// GET /api/v1/medications
router.get('/', authorize('medications:read'), async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req);
    const filter = { organization: req.orgId };
    if (req.query.patient) filter.patient = req.query.patient;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.rxnorm) filter['medication.rxnorm'] = req.query.rxnorm;

    const [data, total] = await Promise.all([
      MedicationRequest.find(filter)
        .populate('requester', 'name')
        .sort({ authoredOn: -1 }).skip(skip).limit(limit).lean(),
      MedicationRequest.countDocuments(filter)
    ]);
    res.json({ data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/medications/:id
router.get('/:id', authorize('medications:read'), async (req, res) => {
  try {
    const med = await MedicationRequest.findOne({ _id: req.params.id, organization: req.orgId })
      .populate('requester', 'name').lean();
    if (!med) return res.status(404).json({ error: 'Medication request not found' });
    res.json({ data: med });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/medications
router.post('/', authorize('medications:write'), auditLog('CREATE', 'MedicationRequest'), [
  body('patient').notEmpty(),
  body('medication.display').notEmpty().withMessage('Medication name required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const med = await MedicationRequest.create({ ...req.body, organization: req.orgId });
    res.status(201).json({ data: med });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/medications/:id  — update status
router.put('/:id', authorize('medications:write'), auditLog('UPDATE', 'MedicationRequest'), async (req, res) => {
  try {
    const med = await MedicationRequest.findOneAndUpdate(
      { _id: req.params.id, organization: req.orgId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!med) return res.status(404).json({ error: 'Medication request not found' });
    res.json({ data: med });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
