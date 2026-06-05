import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthbridge';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));
