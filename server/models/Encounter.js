import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const encounterSchema = new mongoose.Schema({
  fhirId: { type: String, default: uuidv4, unique: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', index: true },
  status: {
    type: String,
    enum: ['planned', 'arrived', 'triaged', 'in-progress', 'onleave', 'finished', 'cancelled'],
    default: 'in-progress', index: true
  },
  class: {
    code: { type: String, enum: ['AMB', 'EMER', 'IMP', 'OBSENC', 'PRENC', 'HH', 'VR'], default: 'AMB' },
    display: String
  },
  type: [{ code: String, system: String, display: String, _id: false }],
  period: {
    start: { type: Date, required: true, index: true },
    end: Date
  },
  reasonCode: [{ code: String, system: String, display: String, _id: false }],
  diagnosis: [{
    condition: { type: mongoose.Schema.Types.ObjectId, ref: 'Condition' },
    use: String, rank: Number, _id: false
  }],
  location: { name: String, type: String, address: String },
  notes: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
    time: Date, text: String,
    type: { type: String, enum: ['progress', 'discharge', 'admission', 'procedure', 'consultation'] }
  }],
  billing: {
    cptCodes: [String],
    icd10Codes: [String],
    totalCharge: Number,
    insurancePaid: Number,
    patientPaid: Number
  },
  followUp: { needed: { type: Boolean, default: false }, instructions: String, timeframe: String },
  dataSource: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource' }
}, { timestamps: true });

encounterSchema.index({ organization: 1, patient: 1 });
encounterSchema.index({ organization: 1, 'period.start': -1 });

export default mongoose.model('Encounter', encounterSchema);
