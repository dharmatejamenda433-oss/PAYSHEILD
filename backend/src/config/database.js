import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Opens the MongoDB connection and waits for model indexes to be created.
 * Unique indexes (transactionId, idempotency key, ledger entries) are part of
 * the correctness guarantees, so we do not accept requests before they exist.
 */
export async function connectDatabase(uri = env.MONGODB_URI) {
  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  const indexBuilds = Object.values(mongoose.models).map((model) => model.init());
  await Promise.all(indexBuilds);

  console.log(
    `[mongo] connected to ${mongoose.connection.host}/${mongoose.connection.name}`
  );
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}
