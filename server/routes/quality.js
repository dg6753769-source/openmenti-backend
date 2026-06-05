import { Router } from 'express';
import Patient from '../models/Patient.js';
import Observation from '../models/Observation.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit.js';
import {
  scorePatient, findDuplicateCandidates,
  detectObservationAnomalies, computeOrganizationQualityReport
} from '../services/dataQuality.js';

const router = Router();
router.use(authenticate);

// GET /api/v1/quality/dashboard
router.get('/dashboard', authorize('quality:read'), async (req, res) => {
  try {
    const report = await computeOrganizationQualityReport(req.orgId, Patient);

    const [lowQuality, noInsurance, noProvider] = await Promise.all([
      Patient.countDocuments({ organization: req.orgId, isDeleted: false, qualityScore: { $lt: 50 } }),
      Patient.countDocuments({ organization: req.orgId, isDeleted: false, insurance: { $size: 0 } }),
      Patient.countDocuments({ organization: req.orgId, isDeleted: false, primaryProvider: { $exists: false } })
    ]);

    res.json({
      data: {
        overallScore: report.score,
        totalPatients: report.totalPatients,
        breakdown: report.breakdown,
        alerts: {
          lowQualityRecords: lowQuality,
          missingInsurance: noInsurance,
          unassignedPatients: noProvider
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/quality/patients  — patients with quality issues
router.get('/patients', authorize('quality:read'), async (req, res) => {
  try {
    const minScore = parseInt(req.query.maxScore) || 60;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const filter = {
      organization: req.orgId,
      isDeleted: false,
      qualityScore: { $lte: minScore }
    };
    if (req.query.severity) {
      filter['qualityFlags.severity'] = req.query.severity;
    }

    const [data, total] = await Promise.all([
      Patient.find(filter)
        .select('fhirId name birthDate gender qualityScore qualityFlags')
        .sort({ qualityScore: 1 })
        .skip((page - 1) * limit).limit(limit)
        .lean({ virtuals: true }),
      Patient.countDocuments(filter)
    ]);

    res.json({ data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/quality/analyze/:patientId  — re-score a single patient
router.post('/analyze/:patientId', authorize('quality:write'), auditLog('QUALITY_CHECK', 'Patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ _id: req.params.patientId, organization: req.orgId, isDeleted: false })
      .lean({ virtuals: true });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const { score, flags } = scorePatient(patient);
    const duplicates = await findDuplicateCandidates(patient, Patient);

    await Patient.findByIdAndUpdate(req.params.patientId, {
      qualityScore: score, qualityFlags: flags
    });

    res.json({
      data: {
        patientId: req.params.patientId,
        qualityScore: score,
        flags,
        duplicateCandidates: duplicates,
        analysisTimestamp: new Date()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/quality/analyze-all  — bulk re-score org's patients
router.post('/analyze-all', authorize('quality:write'), async (req, res) => {
  try {
    const patients = await Patient.find({ organization: req.orgId, isDeleted: false }).lean({ virtuals: true });

    let updated = 0;
    let totalScore = 0;

    for (const p of patients) {
      const { score, flags } = scorePatient(p);
      await Patient.findByIdAndUpdate(p._id, { qualityScore: score, qualityFlags: flags });
      totalScore += score;
      updated++;
    }

    const avgScore = updated ? Math.round(totalScore / updated) : 0;

    res.json({
      data: {
        patientsAnalyzed: updated,
        newAverageQualityScore: avgScore,
        completedAt: new Date()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/quality/dedupe  — find all potential duplicate patients for the org
router.post('/dedupe', authorize('quality:read'), async (req, res) => {
  try {
    const patients = await Patient.find({
      organization: req.orgId,
      isDeleted: false,
      birthDate: { $exists: true }
    }).limit(500).lean({ virtuals: true });

    const duplicateGroups = [];
    const seen = new Set();

    for (const patient of patients) {
      if (seen.has(patient._id.toString())) continue;
      const candidates = await findDuplicateCandidates(patient, Patient);
      const highConf = candidates.filter(c => c.matchScore >= 70);
      if (highConf.length) {
        duplicateGroups.push({
          primary: { id: patient._id, name: patient.fullName, dob: patient.birthDate },
          duplicates: highConf
        });
        highConf.forEach(c => seen.add(c.patientId.toString()));
        seen.add(patient._id.toString());
      }
    }

    res.json({ data: { groups: duplicateGroups, totalGroups: duplicateGroups.length } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/quality/observations/anomalies
router.get('/observations/anomalies', authorize('quality:read'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 50;

    const recent = await Observation.find({
      organization: req.orgId,
      category: 'vital-signs',
      status: 'final',
      effectiveDateTime: { $gte: new Date(Date.now() - 7 * 86400000) }
    }).limit(500).lean();

    const anomalies = [];
    for (const obs of recent) {
      const flags = detectObservationAnomalies(obs);
      if (flags.length) anomalies.push({ observation: obs, flags });
    }

    const paged = anomalies.slice((page - 1) * limit, page * limit);
    res.json({ data: paged, pagination: { total: anomalies.length, page, limit } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
