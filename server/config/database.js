import mongoose from 'mongoose';

export const connectDB = async (models = {}) => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthbridge';

  // Try real MongoDB if URI points to a non-local host or if local is available
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
    return;
  } catch {
    // Falls through to in-memory fallback
  }

  // Fallback: in-memory nedb
  const { setupInMemoryDB } = await import('./inMemoryDb.js');
  await setupInMemoryDB(models);
};

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));
