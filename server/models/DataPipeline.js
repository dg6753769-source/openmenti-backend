import mongoose from 'mongoose';

const pipelineRunSchema = new mongoose.Schema({
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  status: { type: String, enum: ['running', 'success', 'failed', 'partial'], default: 'running' },
  recordsProcessed: { type: Number, default: 0 },
  recordsCreated: { type: Number, default: 0 },
  recordsUpdated: { type: Number, default: 0 },
  recordsSkipped: { type: Number, default: 0 },
  recordsErrored: { type: Number, default: 0 },
  qualityScoreAvg: Number,
  errors: [String],
  triggeredBy: String
});

const dataPipelineSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  description: String,
  source: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource', required: true },
  targetResourceType: {
    type: String,
    enum: ['Patient', 'Encounter', 'Observation', 'Condition', 'MedicationRequest', 'Provider']
  },
  status: {
    type: String, enum: ['active', 'paused', 'draft', 'archived'], default: 'draft'
  },
  transformations: [{
    name: String,
    type: { type: String, enum: ['map_field', 'filter', 'transform_value', 'deduplicate', 'validate', 'enrich'] },
    config: mongoose.Schema.Types.Mixed,
    order: Number,
    _id: false
  }],
  validationRules: [{
    field: String,
    rule: { type: String, enum: ['required', 'format', 'range', 'lookup', 'custom'] },
    config: mongoose.Schema.Types.Mixed,
    severity: { type: String, enum: ['error', 'warning', 'info'] },
    message: String,
    _id: false
  }],
  deduplicationConfig: {
    enabled: { type: Boolean, default: true },
    strategy: { type: String, enum: ['skip', 'update', 'merge'], default: 'update' },
    matchingFields: [String]
  },
  scheduleConfig: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['realtime', 'hourly', 'daily', 'weekly', 'manual'], default: 'manual' }
  },
  notificationConfig: {
    onSuccess: { type: Boolean, default: false },
    onFailure: { type: Boolean, default: true },
    emails: [String]
  },
  runs: [pipelineRunSchema],
  stats: {
    totalRuns: { type: Number, default: 0 },
    successfulRuns: { type: Number, default: 0 },
    failedRuns: { type: Number, default: 0 },
    avgQualityScore: { type: Number, default: 0 },
    totalRecordsProcessed: { type: Number, default: 0 }
  },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('DataPipeline', dataPipelineSchema);
