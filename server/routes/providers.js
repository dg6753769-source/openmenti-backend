import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import Provider from '../models/Provider.js';
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

// GET /api/v1/providers
router.get('/', authorize('providers:read'), async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req);
    const filter = { organization: req.orgId };
    if (req.query.search) {
      filter.$or = [
        { 'name.family': { $regex: req.query.search, $options: 'i' } },
        { npi: req.query.search }
      ];
    }
    if (req.query.specialty) filter['specialty.code'] = req.query.specialty;
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';

    const [data, total] = await Promise.all([
      Provider.find(filter).sort({ 'name.family': 1 }).skip(skip).limit(limit).lean({ virtuals: true }),
      Provider.countDocuments(filter)
    ]);
    res.json({ data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/providers/:id
router.get('/:id', authorize('providers:read'), async (req, res) => {
  try {
    const provider = await Provider.findOne({ _id: req.params.id, organization: req.orgId })
      .lean({ virtuals: true });
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    res.json({ data: provider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/providers/:id/patients
router.get('/:id/patients', authorize('providers:read', 'patients:read'), async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req);
    const filter = { organization: req.orgId, primaryProvider: req.params.id, isDeleted: false };
    const [data, total] = await Promise.all([
      Patient.find(filter).sort({ 'name.family': 1 }).skip(skip).limit(limit).lean({ virtuals: true }),
      Patient.countDocuments(filter)
    ]);
    res.json({ data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/providers
router.post('/', authorize('providers:write'), auditLog('CREATE', 'Provider'), [
  body('name.family').notEmpty().withMessage('Last name required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const provider = await Provider.create({ ...req.body, organization: req.orgId });
    res.status(201).json({ data: provider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/providers/:id
router.put('/:id', authorize('providers:write'), auditLog('UPDATE', 'Provider'), async (req, res) => {
  try {
    const provider = await Provider.findOneAndUpdate(
      { _id: req.params.id, organization: req.orgId },
      req.body,
      { new: true, runValidators: true }
    ).lean({ virtuals: true });
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    res.json({ data: provider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/providers/:id  — soft deactivate
router.delete('/:id', authorize('providers:delete'), async (req, res) => {
  try {
    const provider = await Provider.findOneAndUpdate(
      { _id: req.params.id, organization: req.orgId },
      { active: false },
      { new: true }
    );
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    res.json({ message: 'Provider deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
