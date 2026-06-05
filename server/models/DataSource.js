import mongoose from 'mongoose';

const dataSourceSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  description: String,
  type: {
    type: String,
    enum: ['epic', 'cerner', 'athena', 'eclinicalworks', 'allscripts', 'meditech', 'nextgen',
           'fhir_r4', 'fhir_r3', 'hl7_v2', 'hl7_v3', 'csv', 'json', 'database', 'api', 'custom'],
    required: true
  },
  connectionConfig: {
    baseUrl: String,
    apiKey: String,
    clientId: String,
    clientSecret: String,
    username: String,
    port: Number,
    database: String,
    additionalParams: mongoose.Schema.Types.Mixed
  },
  authConfig: {
    type: { type: String, enum: ['oauth2', 'api_key', 'basic', 'smart_on_fhir', 'none'] },
    tokenUrl: String,
    scope: String,
    accessToken: String,
    expiresAt: Date
  },
  dataTypes: [{
    type: String,
    enum: ['patients', 'encounters', 'observations', 'conditions', 'medications',
           'immunizations', 'allergies', 'procedures', 'documents', 'lab_results']
  }],
  mappingConfig: mongoose.Schema.Types.Mixed,
  scheduleConfig: {
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: ['realtime', 'hourly', 'daily', 'weekly', 'manual'] },
    lastRunAt: Date,
    nextRunAt: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error', 'testing', 'pending'],
    default: 'pending'
  },
  lastSyncAt: Date,
  lastSyncStats: {
    recordsProcessed: Number,
    recordsCreated: Number,
    recordsUpdated: Number,
    recordsErrored: Number,
    duration: Number,
    errorDetails: [String]
  },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('DataSource', dataSourceSchema);
