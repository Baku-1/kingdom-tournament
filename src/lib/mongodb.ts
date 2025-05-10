import mongoose from 'mongoose';

// Define the type for our cached mongoose connection
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Extend the NodeJS global interface
declare global {
  // Using var is required for global augmentation, but we need to disable the ESLint rule
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tournament_db';

// Initialize the cached variable with a default value to avoid undefined
const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

// Set the global mongoose cache
if (!global.mongoose) {
  global.mongoose = cached;
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then(mongoose => mongoose);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectToDatabase;
