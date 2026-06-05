import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const conditionSchema = new mongoose.Schema({
  fhirId: { type: String, default: uuidv4, unique: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  recorder: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  asserter: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  clinicalStatus: {
    type: String,
    enum: ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'],
    default: 'active', index: true
  },
  verificationStatus: {
    type: String,
    enum: ['unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error'],
    default: 'confirmed'
  },
  category: {
    type: String,
    enum: ['problem-list-item', 'encounter-diagnosis', 'health-concern'],
    default: 'problem-list-item'
  },
  severity: { type: String, enum: ['mild', 'moderate', 'severe'] },
  code: {
    system: { type: String, default: 'http://hl7.org/fhir/sid/icd-10' },
    code: { type: String, required: true, index: true },
    display: String
  },
  onsetDate: { type: Date, index: true },
  abatementDate: Date,
  recordedDate: { type: Date, default: Date.now },
  note: String,
  encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter' },
  dataSource: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource' }
}, { timestamps: true });

conditionSchema.index({ organization: 1, patient: 1 });
conditionSchema.index({ organization: 1, 'code.code': 1 });

export default mongoose.model('Condition', conditionSchema);
