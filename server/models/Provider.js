import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const providerSchema = new mongoose.Schema({
  fhirId: { type: String, default: uuidv4, unique: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  npi: { type: String, trim: true, index: true },
  name: {
    family: { type: String, required: true },
    given: [String],
    prefix: String,
    suffix: String
  },
  credentials: [String],  // MD, DO, NP, PA, RN, etc.
  specialty: [{ code: String, display: String }],
  department: String,
  telecom: [{
    system: { type: String, enum: ['phone', 'fax', 'email'] },
    value: String, use: String, _id: false
  }],
  address: { line: [String], city: String, state: String, postalCode: String },
  active: { type: Boolean, default: true, index: true },
  qualifications: [{
    code: String, display: String, issuer: String,
    period: { start: Date, end: Date }, _id: false
  }],
  languages: [String],
  gender: String,
  acceptingNewPatients: { type: Boolean, default: true }
}, { timestamps: true });

providerSchema.index({ organization: 1, active: 1 });

providerSchema.virtual('fullName').get(function () {
  const parts = [];
  if (this.name.prefix) parts.push(this.name.prefix);
  if (this.name.given?.length) parts.push(this.name.given.join(' '));
  parts.push(this.name.family);
  if (this.credentials?.length) parts.push(this.credentials.join(', '));
  return parts.join(' ');
});

providerSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Provider', providerSchema);
