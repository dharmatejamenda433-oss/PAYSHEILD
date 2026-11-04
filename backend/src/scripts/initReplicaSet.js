import mongoose from 'mongoose';

/**
 * Development helper: initiates a single-node replica set.
 * MongoDB transactions (used by the payment engine) are only available on a
 * replica set, so docker-compose configures one automatically. This script is
 * for a manually started local mongod, for example:
 *
 *   mongod --dbpath .local/mongo --port 27018 --replSet rs0 --bind_ip 127.0.0.1
 *   MONGODB_DIRECT_URI=mongodb://127.0.0.1:27018/?directConnection=true npm run db:init-replica
 */
const directUri =
  process.env.MONGODB_DIRECT_URI ||
  'mongodb://127.0.0.1:27018/?directConnection=true';
const replicaSetName = process.env.REPLICA_SET_NAME || 'rs0';
const primaryHost = process.env.REPLICA_PRIMARY_HOST || '127.0.0.1:27018';

async function initReplicaSet() {
  await mongoose.connect(directUri, { serverSelectionTimeoutMS: 5000 });
  const admin = mongoose.connection.db.admin();

  try {
    const result = await admin.command({
      replSetInitiate: {
        _id: replicaSetName,
        members: [{ _id: 0, host: primaryHost }],
      },
    });
    console.log('[replica-set] initiated:', result);
  } catch (error) {
    if (error.code === 23 || /already initialized/i.test(error.message)) {
      console.log(`[replica-set] ${replicaSetName} is already initialized.`);
    } else {
      throw error;
    }
  } finally {
    await mongoose.disconnect();
  }
}

initReplicaSet().catch(async (error) => {
  console.error('[replica-set] failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
