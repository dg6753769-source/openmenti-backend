import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import Patient from '../models/Patient.js';
import Encounter from '../models/Encounter.js';
import Condition from '../models/Condition.js';
import Observation from '../models/Observation.js';
import {
  getPopulationHealthSummary,
  getRiskStratification,
  getCohortAnalysis
} from '../services/analyticsEngine.js';

const router = Router();
router.use(authenticate);

// GET /api/v1/analytics/population
router.get('/population', authorize('analytics:read'), async (req, res) => {
  try {
    const summary = await getPopulationHealthSummary(req.orgId);
    res.json({ data: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/analytics/risk
router.get('/risk', authorize('analytics:read'), async (req, res) => {
  try {
    const patients = await getRiskStratification(req.orgId, {
      riskCategory: req.query.category,
      gender: req.query.gender,
      limit: parseInt(req.query.limit) || 100
    });
    res.json({ data: patients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/analytics/care-gaps
router.get('/care-gaps', authorize('analytics:read'), async (req, res) => {
  try {
    // Aggregate open care gaps across all high-risk patients
    const highRiskPatients = await Patient.find({
      organization: req.orgId,
      isDeleted: false,
      active: true,
      'riskScore.category': { $in: ['high', 'very_high'] }
    }).select('_id fhirId name riskScore').limit(200).lean({ virtuals: true });

    const gapSummary = {};
    let totalOpenGaps = 0;

    // Sample: aggregate gap distribution (full calc would be done async)
    for (const p of highRiskPatients.slice(0, 50)) {
      try {
        const { identifyCareGaps } = await import('../services/analyticsEngine.js');
        const gaps = await identifyCareGaps(p._id, req.orgId);
        const open = gaps.filter(g => g.status === 'open');
        totalOpenGaps += open.length;
        for (const g of open) {
          gapSummary[g.id] = gapSummary[g.id] || { name: g.name, count: 0, highPriority: 0 };
          gapSummary[g.id].count++;
          if (g.priority === 'high') gapSummary[g.id].highPriority++;
        }
      } catch (_) { /* skip individual failures */ }
    }

    const sorted = Object.entries(gapSummary)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.count - a.count);

    res.json({
      data: {
        populationAnalyzed: Math.min(highRiskPatients.length, 50),
        totalOpenGaps,
        gapsByType: sorted
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/analytics/trends
router.get('/trends', authorize('analytics:read'), async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const since = new Date(Date.now() - months * 30 * 86400000);
    const orgId = req.orgId;

    const [encountersByMonth, newPatientsByMonth, conditionTrends] = await Promise.all([
      Encounter.aggregate([
        { $match: { organization: orgId, 'period.start': { $gte: since } } },
        {
          $group: {
            _id: {
              year: { $year: '$period.start' },
              month: { $month: '$period.start' },
              class: '$class.code'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Patient.aggregate([
        { $match: { organization: orgId, isDeleted: false, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Condition.aggregate([
        { $match: { organization: orgId, createdAt: { $gte: since }, clinicalStatus: 'active' } },
        { $group: { _id: { $substr: ['$code.code', 0, 3] }, display: { $first: '$code.display' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 }
      ])
    ]);

    res.json({
      data: {
        period: { months, since },
        encountersByMonth,
        newPatientsByMonth,
        topGrowingConditions: conditionTrends
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/analytics/cohort  — ad-hoc cohort analysis
router.post('/cohort', authorize('analytics:read'), async (req, res) => {
  try {
    const result = await getCohortAnalysis(req.orgId, req.body);
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/analytics/vitals-trend/:patientId  — single-patient vitals history
router.get('/vitals-trend/:patientId', authorize('analytics:read'), async (req, res) => {
  try {
    const loinc = req.query.loinc || '55284-4';  // default: systolic BP
    const months = parseInt(req.query.months) || 12;
    const since = new Date(Date.now() - months * 30 * 86400000);

    const observations = await Observation.find({
      organization: req.orgId,
      patient: req.params.patientId,
      'code.code': loinc,
      status: { $in: ['final', 'amended'] },
      effectiveDateTime: { $gte: since }
    }).sort({ effectiveDateTime: 1 }).select('effectiveDateTime value interpretation').lean();

    res.json({ data: { loinc, observations } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
