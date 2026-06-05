import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: String,
  userName: String,
  action: {
    type: String,
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT', 'LOGIN', 'LOGOUT',
           'PIPELINE_RUN', 'QUALITY_CHECK', 'SEARCH', 'BULK_EXPORT'],
    required: true, index: true
  },
  resource: { type: String, required: true, index: true },
  resourceId: String,
  details: mongoose.Schema.Types.Mixed,
  outcome: { type: String, enum: ['success', 'failure', 'partial'], default: 'success' },
  ipAddress: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: false });

// HIPAA requires 6-year retention; index drives TTL-based cleanup at 7 years
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 3600 });

export default mongoose.model('AuditLog', auditLogSchema);
