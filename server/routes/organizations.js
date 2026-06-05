import { Router } from 'express';
import Organization from '../models/Organization.js';
import Patient from '../models/Patient.js';
import Provider from '../models/Provider.js';
import Encounter from '../models/Encounter.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { computeOrganizationQualityReport } from '../services/dataQuality.js';
import { getPopulationHealthSummary } from '../services/analyticsEngine.js';

const router = Router();
router.use(authenticate);

// GET /api/v1/organizations/me  — current org info
router.get('/me', authorize('org:read'), async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json({ data: org });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/organizations/me/stats
router.get('/me/stats', authorize('org:read'), async (req, res) => {
  try {
    const orgId = req.orgId;
    const [patients, providers, encounters, quality, popHealth] = await Promise.all([
      Patient.countDocuments({ organization: orgId, isDeleted: false, active: true }),
      Provider.countDocuments({ organization: orgId, active: true }),
      Encounter.countDocuments({
        organization: orgId,
        'period.start': { $gte: new Date(Date.now() - 30 * 86400000) }
      }),
      computeOrganizationQualityReport(orgId, Patient),
      getPopulationHealthSummary(orgId)
    ]);

    res.json({
      data: {
        totalActivePatients: patients,
        totalActiveProviders: providers,
        encountersLast30Days: encounters,
        dataQuality: quality,
        populationHealth: popHealth
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/organizations/me
router.put('/me', authorize('org:write'), async (req, res) => {
  try {
    const allowed = ['name', 'address', 'contact', 'settings', 'npi', 'ein'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const org = await Organization.findByIdAndUpdate(req.orgId, update, { new: true });
    res.json({ data: org });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Super-admin: GET /api/v1/organizations
router.get('/', async (req, res) => {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' });
  try {
    const orgs = await Organization.find({}).sort({ createdAt: -1 }).limit(100);
    res.json({ data: orgs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
