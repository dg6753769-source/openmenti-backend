import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import DataPipeline from '../models/DataPipeline.js';
import DataSource from '../models/DataSource.js';
import Patient from '../models/Patient.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { auditLog } from '../middleware/audit.js';
import { emitPipelineEvent } from '../services/alertService.js';
import { scorePatient } from '../services/dataQuality.js';

const router = Router();
router.use(authenticate);

// ─── Data Sources ────────────────────────────────────────────────────────────

// GET /api/v1/pipelines/sources
router.get('/sources', authorize('sources:read'), async (req, res) => {
  try {
    const sources = await DataSource.find({ organization: req.orgId, isDeleted: false })
      .select('-connectionConfig.apiKey -connectionConfig.clientSecret -authConfig.accessToken')
      .sort({ createdAt: -1 });
    res.json({ data: sources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/pipelines/sources
router.post('/sources', authorize('sources:write'), [
  body('name').notEmpty(),
  body('type').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const source = await DataSource.create({ ...req.body, organization: req.orgId });
    res.status(201).json({ data: source });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/pipelines/sources/:id
router.put('/sources/:id', authorize('sources:write'), async (req, res) => {
  try {
    const source = await DataSource.findOneAndUpdate(
      { _id: req.params.id, organization: req.orgId },
      req.body, { new: true }
    );
    if (!source) return res.status(404).json({ error: 'Source not found' });
    res.json({ data: source });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/pipelines/sources/:id/test
router.post('/sources/:id/test', authorize('sources:write'), async (req, res) => {
  try {
    const source = await DataSource.findOne({ _id: req.params.id, organization: req.orgId });
    if (!source) return res.status(404).json({ error: 'Source not found' });

    // Simulate connection test
    const testResult = {
      success: source.connectionConfig?.baseUrl ? true : false,
      message: source.connectionConfig?.baseUrl
        ? `Connection to ${source.type} tested successfully`
        : 'No connection URL configured',
      testedAt: new Date()
    };

    await DataSource.findByIdAndUpdate(source._id, {
      status: testResult.success ? 'active' : 'error'
    });

    res.json({ data: testResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Pipelines ───────────────────────────────────────────────────────────────

// GET /api/v1/pipelines
router.get('/', authorize('pipelines:read'), async (req, res) => {
  try {
    const pipelines = await DataPipeline.find({ organization: req.orgId, isDeleted: false })
      .populate('source', 'name type status')
      .sort({ createdAt: -1 });
    res.json({ data: pipelines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/pipelines/:id
router.get('/:id', authorize('pipelines:read'), async (req, res) => {
  try {
    const pipeline = await DataPipeline.findOne({ _id: req.params.id, organization: req.orgId })
      .populate('source', 'name type status connectionConfig.baseUrl');
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
    res.json({ data: pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/pipelines
router.post('/', authorize('pipelines:write'), [
  body('name').notEmpty(),
  body('source').notEmpty(),
  body('targetResourceType').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const pipeline = await DataPipeline.create({ ...req.body, organization: req.orgId });
    res.status(201).json({ data: pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/pipelines/:id
router.put('/:id', authorize('pipelines:write'), async (req, res) => {
  try {
    const pipeline = await DataPipeline.findOneAndUpdate(
      { _id: req.params.id, organization: req.orgId },
      req.body, { new: true }
    );
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
    res.json({ data: pipeline });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/pipelines/:id/run  — execute pipeline
router.post('/:id/run', authorize('pipelines:run'), auditLog('PIPELINE_RUN', 'DataPipeline'), async (req, res) => {
  try {
    const pipeline = await DataPipeline.findOne({ _id: req.params.id, organization: req.orgId });
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
    if (pipeline.status === 'archived') return res.status(400).json({ error: 'Cannot run archived pipeline' });

    const runId = pipeline.runs.length;
    const run = {
      startedAt: new Date(),
      status: 'running',
      triggeredBy: req.user.email
    };
    pipeline.runs.push(run);
    pipeline.stats.totalRuns += 1;
    await pipeline.save();

    // Notify start
    emitPipelineEvent(req.orgId.toString(), pipeline._id.toString(), 'PIPELINE_STARTED', {
      pipelineName: pipeline.name, runId
    });

    // Simulate async processing
    setImmediate(async () => {
      try {
        // Simulate: score existing patients for this org
        const patients = await Patient.find({ organization: req.orgId, isDeleted: false }).limit(100);
        let created = 0, updated = 0, errored = 0;
        let qualitySum = 0;

        for (const p of patients) {
          try {
            const { score, flags } = scorePatient(p.toObject({ virtuals: true }));
            await Patient.findByIdAndUpdate(p._id, { qualityScore: score, qualityFlags: flags });
            qualitySum += score;
            updated++;
          } catch {
            errored++;
          }
        }

        const avgQuality = patients.length ? Math.round(qualitySum / patients.length) : 0;

        await DataPipeline.findByIdAndUpdate(pipeline._id, {
          $set: {
            [`runs.${runId}.status`]: 'success',
            [`runs.${runId}.completedAt`]: new Date(),
            [`runs.${runId}.recordsProcessed`]: patients.length,
            [`runs.${runId}.recordsCreated`]: created,
            [`runs.${runId}.recordsUpdated`]: updated,
            [`runs.${runId}.recordsErrored`]: errored,
            [`runs.${runId}.qualityScoreAvg`]: avgQuality,
            'stats.successfulRuns': pipeline.stats.successfulRuns + 1,
            'stats.totalRecordsProcessed': pipeline.stats.totalRecordsProcessed + patients.length,
            'stats.avgQualityScore': avgQuality
          }
        });

        emitPipelineEvent(req.orgId.toString(), pipeline._id.toString(), 'PIPELINE_COMPLETED', {
          pipelineName: pipeline.name, recordsProcessed: patients.length, avgQuality
        });
      } catch (err) {
        await DataPipeline.findByIdAndUpdate(pipeline._id, {
          $set: {
            [`runs.${runId}.status`]: 'failed',
            [`runs.${runId}.completedAt`]: new Date(),
            [`runs.${runId}.errorLog`]: [err.message],
            'stats.failedRuns': pipeline.stats.failedRuns + 1
          }
        });
        emitPipelineEvent(req.orgId.toString(), pipeline._id.toString(), 'PIPELINE_FAILED', {
          pipelineName: pipeline.name, error: err.message
        });
      }
    });

    res.json({ message: 'Pipeline started', data: { runId, pipelineId: pipeline._id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/pipelines/:id/runs
router.get('/:id/runs', authorize('pipelines:read'), async (req, res) => {
  try {
    const pipeline = await DataPipeline.findOne({ _id: req.params.id, organization: req.orgId })
      .select('name runs stats');
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
    const runs = [...pipeline.runs].reverse().slice(0, 20);
    res.json({ data: { runs, stats: pipeline.stats } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
