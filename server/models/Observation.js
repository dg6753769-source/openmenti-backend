import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const observationSchema = new mongoose.Schema({
  fhirId: { type: String, default: uuidv4, unique: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter' },
  performer: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  status: {
    type: String,
    enum: ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled'],
    default: 'final', index: true
  },
  category: {
    type: String,
    enum: ['vital-signs', 'laboratory', 'social-history', 'imaging', 'procedure', 'survey', 'exam'],
    index: true
  },
  code: {
    system: { type: String, default: 'http://loinc.org' },
    code: { type: String, required: true, index: true },
    display: String
  },
  effectiveDateTime: { type: Date, required: true, index: true },
  value: {
    quantity: { value: Number, unit: String, system: String, code: String },
    string: String,
    boolean: Boolean,
    codeableConcept: { code: String, display: String }
  },
  interpretation: {
    code: { type: String, enum: ['N', 'H', 'HH', 'L', 'LL', 'A', 'AA', 'POS', 'NEG'] },
    display: String
  },
  referenceRange: [{
    low: { value: Number, unit: String },
    high: { value: Number, unit: String },
    text: String, type: String, _id: false
  }],
  // For panel results (e.g. CBC) - individual components
  components: [{
    code: { code: String, display: String, system: String },
    value: { quantity: { value: Number, unit: String }, string: String },
    _id: false
  }],
  note: String,
  dataSource: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource' }
}, { timestamps: true });

observationSchema.index({ organization: 1, patient: 1, category: 1 });
observationSchema.index({ organization: 1, 'code.code': 1 });
observationSchema.index({ organization: 1, effectiveDateTime: -1 });

export default mongoose.model('Observation', observationSchema);
