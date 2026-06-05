import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8 },
  name: {
    first: { type: String, required: true, trim: true },
    last: { type: String, required: true, trim: true }
  },
  role: {
    type: String,
    enum: ['super_admin', 'org_admin', 'provider', 'analyst', 'viewer'],
    default: 'viewer'
  },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  refreshToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

export default mongoose.model('User', userSchema);
