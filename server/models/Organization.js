import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  type: {
    type: String,
    enum: ['hospital', 'clinic', 'lab', 'pharmacy', 'payer', 'hie', 'aco', 'provider_group'],
    required: true
  },
  npi: { type: String, trim: true },
  ein: { type: String, trim: true },
  address: {
    street: String, city: String, state: String, zip: String,
    country: { type: String, default: 'US' }
  },
  contact: { phone: String, fax: String, email: String, website: String },
  subscription: {
    tier: { type: String, enum: ['free', 'starter', 'professional', 'enterprise'], default: 'free' },
    startDate: Date,
    endDate: Date,
    maxPatients: { type: Number, default: 500 },
    maxUsers: { type: Number, default: 5 },
    maxDataSources: { type: Number, default: 2 },
    features: {
      fhirApi: { type: Boolean, default: true },
      advancedAnalytics: { type: Boolean, default: false },
      populationHealth: { type: Boolean, default: false },
      customPipelines: { type: Boolean, default: false },
      aiDataQuality: { type: Boolean, default: false },
      bulkExport: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: true }
    }
  },
  settings: {
    timezone: { type: String, default: 'America/New_York' },
    dateFormat: { type: String, default: 'MM/DD/YYYY' },
    defaultLanguage: { type: String, default: 'en' },
    hipaaContactName: String,
    hipaaContactEmail: String
  },
  isActive: { type: Boolean, default: true },
  stats: {
    totalPatients: { type: Number, default: 0 },
    totalProviders: { type: Number, default: 0 },
    totalEncounters: { type: Number, default: 0 },
    dataQualityScore: { type: Number, default: 0 }
  }
}, { timestamps: true });

export default mongoose.model('Organization', organizationSchema);
