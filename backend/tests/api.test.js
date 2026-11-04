import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestDatabase, clearTestDatabase, teardownTestDatabase, initModelIndexes } from './testDb.js';

let app;
let User;
let Account;
let Transaction;
let LedgerEntry;
let Review;
let FraudAlert;
let Device;
let signToken;
let connectRedis;
let disconnectRedis;
let getRedisClient;
let velocityService;
let resetRateLimitMemory;

let emailCounter = 0;

beforeAll(async () => {
  await setupTestDatabase();

  app = (await import('../src/app.js')).createApp();
  ({ User } = await import('../src/models/User.js'));
  ({ Account } = await import('../src/models/Account.js'));
  ({ Transaction } = await import('../src/models/Transaction.js'));
  ({ LedgerEntry } = await import('../src/models/LedgerEntry.js'));
  ({ Review } = await import('../src/models/Review.js'));
  ({ FraudAlert } = await import('../src/models/FraudAlert.js'));
  ({ Device } = await import('../src/models/Device.js'));
  ({ signToken } = await import('../src/services/tokenService.js'));
  ({ connectRedis, disconnectRedis, getRedisClient } = await import('../src/config/redis.js'));
  velocityService = await import('../src/services/velocityService.js');
  ({ resetRateLimitMemory } = await import('../src/middleware/rateLimiter.js'));

  await initModelIndexes();
  await connectRedis();
});

afterAll(async () => {
  await disconnectRedis();
  await teardownTestDatabase();
});

beforeEach(async () => {
  await clearTestDatabase();
  velocityService.resetVelocityMemoryStore();
  resetRateLimitMemory();

  const redis = getRedisClient();
  if (redis) {
    await redis.flushall();
  }
});

function bearer(token) {
  return `Bearer ${token}`;
}

async function registerCustomer(overrides = {}) {
  emailCounter += 1;

  const payload = {
    name: 'Test Customer',
    email: `customer${emailCounter}@example.com`,
    password: 'Password123',
    ...overrides,
  };

  const response = await request(app).post('/api/auth/register').send(payload);
  return response;
}

async function createAdmin() {
  const passwordHash = await bcrypt.hash('Admin@12345', 4);
  const admin = await User.create({
    name: 'Admin User',
    email: `admin${Date.now()}${Math.random()}@example.com`,
    passwordHash,
    role: 'admin',
  });

  return { admin, token: signToken(admin) };
}

async function createRegisteredPair() {
  const senderResponse = await registerCustomer();
  const receiverResponse = await registerCustomer();

  return {
    sender: senderResponse.body.data,
    receiver: receiverResponse.body.data,
  };
}

function makeTransfer(token, { receiverEmail, amount, description = '', key, device = 'device-known', location = 'IN-MH-Pune' }) {
  let call = request(app)
    .post('/api/transactions')
    .set('Authorization', bearer(token))
    .set('X-Device-Id', device)
    .set('X-Client-Location', location);

  if (key) {
    call = call.set('Idempotency-Key', key);
  }

  return call.send({ receiverEmail, amount, description });
}

async function createMediumRiskPendingTransfer(pair, key = 'review-key-0001') {
  // Three recent failed attempts (+15) and a new device (+15) reach the
  // MEDIUM threshold without using the unavailable ML service.
  await velocityService.recordFailedAttempt(pair.sender.user.id);
  await velocityService.recordFailedAttempt(pair.sender.user.id);
  await velocityService.recordFailedAttempt(pair.sender.user.id);

  return makeTransfer(pair.sender.token, {
    receiverEmail: pair.receiver.user.email,
    amount: 100000,
    key,
    device: `review-device-${Date.now()}`,
  });
}

describe('PayShield API', () => {
  test('1. registers a customer with a simulated wallet', async () => {
    const response = await registerCustomer();

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user.role).toBe('customer');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.account.balance).toBe(5000000);
    expect(response.body.data.account.currency).toBe('INR');
  });

  test('2. logs in with valid credentials and rejects a bad password', async () => {
    const registration = await registerCustomer();
    const { email } = registration.body.data.user;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password123' });

    expect(login.status).toBe(200);
    expect(login.body.data.token).toEqual(expect.any(String));

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword1' });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');
  });

  test('3. blocks unauthenticated access to private routes', async () => {
    const missingToken = await request(app).get('/api/accounts/me');
    expect(missingToken.status).toBe(401);

    const invalidToken = await request(app)
      .get('/api/accounts/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(invalidToken.status).toBe(401);
    expect(invalidToken.body.error.code).toBe('UNAUTHORIZED');
  });

  test('4. forbids customers from accessing admin routes', async () => {
    const customer = await registerCustomer();

    const response = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', bearer(customer.body.data.token));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  test('5. completes a low-risk transfer and moves money', async () => {
    const pair = await createRegisteredPair();

    const response = await makeTransfer(pair.sender.token, {
      receiverEmail: pair.receiver.user.email,
      amount: 100000,
      key: 'success-key-0001',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.replay).toBe(false);
    expect(response.body.data.transaction.status).toBe('COMPLETED');
    expect(response.body.data.transaction.riskLevel).toBe('LOW');
    expect(response.body.data.transaction.completedAt).toBeTruthy();

    const senderAccount = await Account.findOne({ userId: pair.sender.user.id });
    const receiverAccount = await Account.findOne({ userId: pair.receiver.user.id });

    expect(senderAccount.balance).toBe(4900000);
    expect(receiverAccount.balance).toBe(5100000);
    expect(await LedgerEntry.countDocuments({})).toBe(2);
  });

  test('6. rejects a transfer with insufficient balance without changing money', async () => {
    const pair = await createRegisteredPair();

    const response = await makeTransfer(pair.sender.token, {
      receiverEmail: pair.receiver.user.email,
      amount: 6000000,
      key: 'insufficient-key-1',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_FUNDS');

    const senderAccount = await Account.findOne({ userId: pair.sender.user.id });
    const receiverAccount = await Account.findOne({ userId: pair.receiver.user.id });

    expect(senderAccount.balance).toBe(5000000);
    expect(receiverAccount.balance).toBe(5000000);
    expect(await Transaction.countDocuments({})).toBe(0);
    expect(await LedgerEntry.countDocuments({})).toBe(0);
  });

  test('7. replays the same idempotent request without charging twice', async () => {
    const pair = await createRegisteredPair();
    const requestBody = {
      receiverEmail: pair.receiver.user.email,
      amount: 100000,
      key: 'duplicate-key-0001',
    };

    const first = await makeTransfer(pair.sender.token, requestBody);
    const second = await makeTransfer(pair.sender.token, requestBody);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.replay).toBe(true);
    expect(second.body.data.transaction.transactionId).toBe(
      first.body.data.transaction.transactionId
    );

    expect(await Transaction.countDocuments({})).toBe(1);
    expect(await LedgerEntry.countDocuments({})).toBe(2);

    const senderAccount = await Account.findOne({ userId: pair.sender.user.id });
    expect(senderAccount.balance).toBe(4900000);
  });

  test('8. rejects the same idempotency key with different payment details', async () => {
    const pair = await createRegisteredPair();

    const first = await makeTransfer(pair.sender.token, {
      receiverEmail: pair.receiver.user.email,
      amount: 100000,
      key: 'conflict-key-0001',
    });

    const conflict = await makeTransfer(pair.sender.token, {
      receiverEmail: pair.receiver.user.email,
      amount: 200000,
      key: 'conflict-key-0001',
    });

    expect(first.status).toBe(201);
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await Transaction.countDocuments({})).toBe(1);

    const senderAccount = await Account.findOne({ userId: pair.sender.user.id });
    expect(senderAccount.balance).toBe(4900000);
  });

  test('9. flags a fraudulent-looking transfer for manual review without moving money', async () => {
    const pair = await createRegisteredPair();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await velocityService.recordFailedAttempt(pair.sender.user.id);
    }

    const response = await makeTransfer(pair.sender.token, {
      receiverEmail: pair.receiver.user.email,
      amount: 4500000,
      key: 'fraud-key-0001',
      device: 'brand-new-fraud-device',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.transaction.status).toBe('PENDING_REVIEW');
    expect(response.body.data.transaction.riskLevel).toBe('HIGH');
    expect(response.body.data.transaction.riskScore).toBeGreaterThanOrEqual(70);

    const codes = response.body.data.transaction.riskReasons.map((reason) => reason.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'LARGE_AMOUNT',
        'LARGE_SHARE_OF_BALANCE',
        'NEW_DEVICE',
        'FAILED_ATTEMPTS',
      ])
    );
    expect(response.body.data.transaction.mlAvailable).toBe(false);

    const senderAccount = await Account.findOne({ userId: pair.sender.user.id });
    const receiverAccount = await Account.findOne({ userId: pair.receiver.user.id });
    expect(senderAccount.balance).toBe(5000000);
    expect(receiverAccount.balance).toBe(5000000);
    expect(await LedgerEntry.countDocuments({})).toBe(0);

    const alert = await FraudAlert.findOne({});
    expect(alert).not.toBeNull();
    expect(alert.status).toBe('OPEN');
  });

  test('10. exposes a medium-risk payment to the admin review queue', async () => {
    const pair = await createRegisteredPair();
    const pending = await createMediumRiskPendingTransfer(pair);

    expect(pending.status).toBe(201);
    expect(pending.body.data.transaction.status).toBe('PENDING_REVIEW');
    expect(pending.body.data.transaction.riskLevel).toBe('MEDIUM');

    const { token: adminToken } = await createAdmin();

    const alerts = await request(app)
      .get('/api/admin/fraud-alerts?status=OPEN')
      .set('Authorization', bearer(adminToken));

    expect(alerts.status).toBe(200);
    expect(alerts.body.data.items).toHaveLength(1);
    expect(alerts.body.data.items[0].transaction.status).toBe('PENDING_REVIEW');

    const dashboard = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', bearer(adminToken));

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.metrics.pendingReviews).toBe(1);
    expect(dashboard.body.data.metrics.flaggedTransactions).toBe(1);
  });

  test('11. lets an admin approve a pending transfer atomically', async () => {
    const pair = await createRegisteredPair();
    const pending = await createMediumRiskPendingTransfer(pair, 'approve-key-0001');
    const transactionId = pending.body.data.transaction.transactionId;

    const { token: adminToken } = await createAdmin();

    const approval = await request(app)
      .post(`/api/admin/reviews/${transactionId}/approve`)
      .set('Authorization', bearer(adminToken))
      .send({ reason: 'Verified with the customer by phone.' });

    expect(approval.status).toBe(200);
    expect(approval.body.data.decision).toBe('APPROVED');
    expect(approval.body.data.transaction.status).toBe('COMPLETED');

    const senderAccount = await Account.findOne({ userId: pair.sender.user.id });
    const receiverAccount = await Account.findOne({ userId: pair.receiver.user.id });
    expect(senderAccount.balance).toBe(4900000);
    expect(receiverAccount.balance).toBe(5100000);
    expect(await LedgerEntry.countDocuments({})).toBe(2);

    const review = await Review.findOne({});
    expect(review.decision).toBe('APPROVED');

    const alert = await FraudAlert.findOne({});
    expect(alert.status).toBe('RESOLVED');

    const repeat = await request(app)
      .post(`/api/admin/reviews/${transactionId}/approve`)
      .set('Authorization', bearer(adminToken))
      .send({ reason: 'Trying to approve a second time.' });

    expect(repeat.status).toBe(409);

    const senderAccountAfter = await Account.findOne({ userId: pair.sender.user.id });
    expect(senderAccountAfter.balance).toBe(4900000);
  });

  test('12. lets an admin reject a pending transfer without moving money', async () => {
    const pair = await createRegisteredPair();
    const pending = await createMediumRiskPendingTransfer(pair, 'reject-key-0001');
    const transactionId = pending.body.data.transaction.transactionId;

    const { token: adminToken } = await createAdmin();

    const rejection = await request(app)
      .post(`/api/admin/reviews/${transactionId}/reject`)
      .set('Authorization', bearer(adminToken))
      .send({ reason: 'Device and location could not be verified.' });

    expect(rejection.status).toBe(200);
    expect(rejection.body.data.decision).toBe('REJECTED');
    expect(rejection.body.data.transaction.status).toBe('DECLINED');

    const senderAccount = await Account.findOne({ userId: pair.sender.user.id });
    const receiverAccount = await Account.findOne({ userId: pair.receiver.user.id });
    expect(senderAccount.balance).toBe(5000000);
    expect(receiverAccount.balance).toBe(5000000);
    expect(await LedgerEntry.countDocuments({})).toBe(0);

    const review = await Review.findOne({});
    expect(review.decision).toBe('REJECTED');

    const alert = await FraudAlert.findOne({});
    expect(alert.status).toBe('RESOLVED');
  });

  test('13. keeps ledger debit-credit entries consistent with balances', async () => {
    const pair = await createRegisteredPair();

    const transfer = await makeTransfer(pair.sender.token, {
      receiverEmail: pair.receiver.user.email,
      amount: 250000,
      key: 'ledger-key-0001',
    });
    expect(transfer.status).toBe(201);

    const entries = await LedgerEntry.find({}).lean();
    expect(entries).toHaveLength(2);

    const debit = entries.find((entry) => entry.entryType === 'DEBIT');
    const credit = entries.find((entry) => entry.entryType === 'CREDIT');

    expect(debit.amount).toBe(250000);
    expect(credit.amount).toBe(250000);
    expect(debit.amount - credit.amount).toBe(0);

    const senderAccount = await Account.findOne({ userId: pair.sender.user.id });
    const receiverAccount = await Account.findOne({ userId: pair.receiver.user.id });

    expect(debit.balanceAfter).toBe(senderAccount.balance);
    expect(credit.balanceAfter).toBe(receiverAccount.balance);
    expect(senderAccount.balance + receiverAccount.balance).toBe(10000000);
    expect(senderAccount.balance).toBeGreaterThanOrEqual(0);

    const ledgerResponse = await request(app)
      .get('/api/accounts/me/ledger')
      .set('Authorization', bearer(pair.sender.token));

    expect(ledgerResponse.status).toBe(200);
    expect(ledgerResponse.body.data.items).toHaveLength(1);
    expect(ledgerResponse.body.data.items[0].entryType).toBe('DEBIT');
    expect(ledgerResponse.body.data.items[0].balanceAfter).toBe(4750000);
  });

  test('14. never allows a negative balance under concurrent transfers', async () => {
    const pair = await createRegisteredPair();

    await Device.create({
      userId: pair.sender.user.id,
      deviceId: 'concurrent-device-a',
      lastSeen: new Date(),
    });
    await Device.create({
      userId: pair.sender.user.id,
      deviceId: 'concurrent-device-b',
      lastSeen: new Date(),
    });

    const [first, second] = await Promise.all([
      makeTransfer(pair.sender.token, {
        receiverEmail: pair.receiver.user.email,
        amount: 2600000,
        key: 'concurrent-key-a',
        device: 'concurrent-device-a',
      }),
      makeTransfer(pair.sender.token, {
        receiverEmail: pair.receiver.user.email,
        amount: 2600000,
        key: 'concurrent-key-b',
        device: 'concurrent-device-b',
      }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 422]);

    const senderAccount = await Account.findOne({ userId: pair.sender.user.id });
    const receiverAccount = await Account.findOne({ userId: pair.receiver.user.id });

    expect(senderAccount.balance).toBe(2400000);
    expect(receiverAccount.balance).toBe(7600000);
    expect(senderAccount.balance).toBeGreaterThanOrEqual(0);

    expect(await Transaction.countDocuments({ status: 'COMPLETED' })).toBe(1);
    expect(await LedgerEntry.countDocuments({})).toBe(2);
  });

  test('15. validates input and ignores attempted role escalation on registration', async () => {
    const escalation = await registerCustomer({ role: 'admin' });
    expect(escalation.status).toBe(400);
    expect(escalation.body.error.code).toBe('VALIDATION_ERROR');

    const pair = await createRegisteredPair();

    const fractionalAmount = await makeTransfer(pair.sender.token, {
      receiverEmail: pair.receiver.user.email,
      amount: 100.5,
      key: 'validation-key-01',
    });
    expect(fractionalAmount.status).toBe(400);

    const zeroAmount = await makeTransfer(pair.sender.token, {
      receiverEmail: pair.receiver.user.email,
      amount: 0,
      key: 'validation-key-02',
    });
    expect(zeroAmount.status).toBe(400);
  });

  test('16. serves health and admin analytics from real data', async () => {
    const pair = await createRegisteredPair();

    await makeTransfer(pair.sender.token, {
      receiverEmail: pair.receiver.user.email,
      amount: 150000,
      key: 'analytics-key-0001',
    });

    await createMediumRiskPendingTransfer(pair, 'analytics-key-0002');

    const { token: adminToken } = await createAdmin();

    const analytics = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', bearer(adminToken));

    expect(analytics.status).toBe(200);
    expect(analytics.body.data.periodDays).toBe(14);
    expect(analytics.body.data.dailySeries).toHaveLength(14);
    expect(analytics.body.data.riskDistribution).toEqual(
      expect.arrayContaining([{ level: 'LOW', count: expect.any(Number) }])
    );
    expect(analytics.body.data.mlStats.totalTransactions).toBe(2);

    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.data.database).toBe('connected');
  });
});
