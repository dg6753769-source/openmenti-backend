import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const medicationRequestSchema = new mongoose.Schema({
  fhirId: { type: String, default: uuidv4, unique: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },
  encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Encounter' },
  status: {
    type: String,
    enum: ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown'],
    default: 'active', index: true
  },
  intent: {
    type: String,
    enum: ['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order'],
    default: 'order'
  },
  medication: {
    rxnorm: String,
    ndc: String,
    display: { type: String, required: true },
    form: String,
    strength: String,
    brand: String,
    generic: String
  },
  dosageInstruction: [{
    text: String,
    timing: {
      frequency: Number,
      period: Number,
      periodUnit: { type: String, enum: ['s', 'min', 'h', 'd', 'wk', 'mo', 'a'] }
    },
    route: { code: String, display: String },
    doseQuantity: { value: Number, unit: String },
    _id: false
  }],
  dispenseRequest: {
    quantity: { value: Number, unit: String },
    expectedSupplyDuration: { value: Number, unit: String },
    numberOfRepeatsAllowed: Number
  },
  authoredOn: { type: Date, default: Date.now },
  reasonCode: [{ code: String, display: String, _id: false }],
  reasonReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Condition' },
  note: String,
  dataSource: { type: mongoose.Schema.Types.ObjectId, ref: 'DataSource' }
}, { timestamps: true });

medicationRequestSchema.index({ organization: 1, patient: 1 });
medicationRequestSchema.index({ organization: 1, 'medication.rxnorm': 1 });

export default mongoose.model('MedicationRequest', medicationRequestSchema);
