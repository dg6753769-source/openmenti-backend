import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Condition from '../models/Condition.js';
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

// GET /api/v1/conditions
router.get('/', authorize('conditions:read'), async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req);
    const filter = { organization: req.orgId };
    if (req.query.patient) filter.patient = req.query.patient;
    if (req.query.status) filter.clinicalStatus = req.query.status;
    if (req.query.code) filter['code.code'] = { $regex: `^${req.query.code}`, $options: 'i' };
    if (req.query.category) filter.category = req.query.category;

    const [data, total] = await Promise.all([
      Condition.find(filter)
        .populate('recorder', 'name')
        .sort({ onsetDate: -1 }).skip(skip).limit(limit).lean(),
      Condition.countDocuments(filter)
    ]);
    res.json({ data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/conditions/:id
router.get('/:id', authorize('conditions:read'), async (req, res) => {
  try {
    const cond = await Condition.findOne({ _id: req.params.id, organization: req.orgId })
      .populate('recorder', 'name').lean();
    if (!cond) return res.status(404).json({ error: 'Condition not found' });
    res.json({ data: cond });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/conditions
router.post('/', authorize('conditions:write'), auditLog('CREATE', 'Condition'), [
  body('patient').notEmpty(),
  body('code.code').notEmpty().withMessage('ICD-10 code required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const cond = await Condition.create({ ...req.body, organization: req.orgId });
    res.status(201).json({ data: cond });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/conditions/:id  — update status, abatement, notes
router.put('/:id', authorize('conditions:write'), auditLog('UPDATE', 'Condition'), async (req, res) => {
  try {
    const cond = await Condition.findOneAndUpdate(
      { _id: req.params.id, organization: req.orgId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!cond) return res.status(404).json({ error: 'Condition not found' });
    res.json({ data: cond });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
