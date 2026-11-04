import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let memoryServer = null;

/**
 * Uses MONGO_TEST_URI when provided (for example a local rs0 instance).
 * Otherwise starts an in-memory single-node replica set so MongoDB
 * transactions work in CI without any external service.
 */
export async function setupTestDatabase() {
  let uri = process.env.MONGO_TEST_URI;

  if (!uri) {
    memoryServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    uri = memoryServer.getUri('payshield_test');
  }

  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  console.log(`[tests] MongoDB ready at ${uri}`);
}

export async function initModelIndexes() {
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function clearTestDatabase() {
  const collections = await mongoose.connection.db.collections();

  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

export async function teardownTestDatabase() {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
  }
}
