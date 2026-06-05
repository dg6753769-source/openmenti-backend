import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const patientSchema = new mongoose.Schema({
  fhirId: { type: String, default: uuidv4, unique: true, index: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  identifiers: [{
    system: String,   // 'MRN', 'SSN', 'EHR_ID', etc.
    value: { type: String, required: true },
    type: String,
    _id: false
  }],
  name: [{
    use: { type: String, enum: ['official', 'usual', 'nickname', 'maiden'], default: 'official' },
    family: { type: String, required: true },
    given: [String],
    prefix: String,
    suffix: String,
    _id: false
  }],
  birthDate: { type: Date, index: true },
  gender: { type: String, enum: ['male', 'female', 'other', 'unknown'], index: true },
  race: String,
  ethnicity: String,
  language: { type: String, default: 'en' },
  address: [{
    use: { type: String, enum: ['home', 'work', 'temp', 'billing'], default: 'home' },
    line: [String], city: String, state: String,
    postalCode: String, country: { type: String, default: 'US' },
    _id: false
  }],
  telecom: [{
    system: { type: String, enum: ['phone', 'fax', 'email', 'sms'] },
    value: String,
    use: { type: String, enum: ['home', 'work', 'mobile'] },
    _id: false
  }],
  insurance: [{
    payerName: String, payerId: String, memberId: String,
    groupId: String, planName: String,
    planType: { type: String, enum: ['commercial', 'medicare', 'medicaid', 'chip', 'self_pay', 'other'] },
    effectiveDate: Date, terminationDate: Date,
    isPrimary: { type: Boolean, default: false },
    _id: false
  }],
  primaryProvider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  careTeam: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }],
  deceased: { isDeceased: { type: Boolean, default: false }, date: Date },
  active: { type: Boolean, default: true, index: true },
  dataSource: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource' },
  sourceRecordId: String,
  // AI-computed quality & risk
  qualityScore: { type: Number, default: 0, min: 0, max: 100 },
  qualityFlags: [{
    field: String,
    issue: String,
    severity: { type: String, enum: ['error', 'warning', 'info'] },
    _id: false
  }],
  riskScore: {
    value: { type: Number, default: 0 },
    category: { type: String, enum: ['low', 'medium', 'high', 'very_high'] },
    lastCalculated: Date,
    factors: [String]
  },
  sdoh: {  // Social determinants of health
    housingStatus: String, employmentStatus: String,
    educationLevel: String, smokingStatus: String,
    alcoholUse: String, substanceUse: String
  },
  lastEncounterDate: Date,
  tags: [String],
  isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true });

patientSchema.index({ organization: 1, active: 1 });
patientSchema.index({ organization: 1, 'name.family': 1 });
patientSchema.index({ organization: 1, birthDate: 1 });
patientSchema.index({ organization: 1, isDeleted: 1 });
patientSchema.index({ 'identifiers.value': 1 });

patientSchema.virtual('fullName').get(function () {
  const n = this.name?.find(x => x.use === 'official') || this.name?.[0];
  if (!n) return '';
  return [n.given?.join(' '), n.family].filter(Boolean).join(' ');
});

patientSchema.virtual('age').get(function () {
  if (!this.birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - new Date(this.birthDate).getFullYear();
  const m = today.getMonth() - new Date(this.birthDate).getMonth();
  if (m < 0 || (m === 0 && today.getDate() < new Date(this.birthDate).getDate())) age--;
  return age;
});

patientSchema.set('toJSON', { virtuals: true });
patientSchema.set('toObject', { virtuals: true });

export default mongoose.model('Patient', patientSchema);
