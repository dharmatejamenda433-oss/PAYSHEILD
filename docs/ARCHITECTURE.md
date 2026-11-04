# PayShield Architecture — A Beginner-Friendly Tour

This document explains how PayShield is put together and why. It follows one payment from the
React form to MongoDB and back, then walks through each directory so you can find your way
around the codebase.

If you are new to the project, read the [end-to-end request trace](#end-to-end-request-trace)
first, then use the file tour as a reference.

> Everything in PayShield is simulated. No real bank, card network or payment rail is involved.

---

## 1. The big picture

PayShield has three applications and two data stores:

```text
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│   React + Vite SPA                                          │
│   REST through Axios, live events through Socket.IO         │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ Express API (backend/)                                      │
│   authentication · payment orchestration · admin operations │
│   state machine · idempotency · ledger · analytics          │
└───────┬──────────────────┬──────────────────┬───────────────┘
        │                  │                  │
┌───────▼────────┐  ┌──────▼───────┐  ┌───────▼──────────────┐
│ MongoDB        │  │ Redis        │  │ FastAPI fraud service│
│ durable state  │  │ fast counters│  │ rules + ML model     │
│ transactions   │  │ rate limits  │  │ /predict, /health    │
│ double-entry   │  │ idempotency  │  │                      │
└────────────────┘  └──────────────┘  └──────────────────────┘
```

Why three applications?

- **Node/Express** owns the domain rules and money movement. It is the only writer to MongoDB.
- **Python/FastAPI** owns the ML model. Python has the mature data/ML ecosystem, and keeping
  inference separate means the API can degrade gracefully if the model host is down.
- **Redis** owns ephemeral counters (velocity windows, rate limits). Losing Redis must never
  lose money, so MongoDB remains the durable source of truth.

---

## 2. The data model

All money is stored as an **integer number of paise** (1 INR = 100 paise). This avoids
floating-point rounding problems.

### `User`

Identity and role. Passwords are stored as bcrypt hashes, never plaintext. `role` is
`customer` or `admin`. Public serialization hides the hash.

### `Account`

One simulated wallet per customer. Fields include `userId`, `balance` (paise), `currency`
(`INR`) and `status` (`active`/`inactive`). A user can have at most one account.

### `Transaction`

The payment record and audit trail. Important fields:

| Field | Meaning |
| --- | --- |
| `transactionId` | Human-readable public reference (`TXN-…`) |
| `senderId`, `receiverId` | Customer references |
| `amount`, `currency` | Integer paise and currency |
| `status` | State machine value |
| `decision` | `APPROVE`, `MANUAL_REVIEW` or `DECLINE` |
| `riskScore`, `riskLevel` | Final blended score and LOW/MEDIUM/HIGH |
| `riskReasons` | Array of `{ code, message, weight }` |
| `mlProbability`, `mlAvailable`, `mlModel` | Model output and provenance |
| `idempotencyKey`, `requestHash` | Durable replay protection |
| `clientDeviceId`, `clientLocation` | Risk context |
| `reviewedBy`, `reviewedAt`, `reviewReason` | Admin outcome |
| `completedAt`, `declinedAt`, `failureReason` | Lifecycle timestamps |

A compound unique index on `{ senderId, idempotencyKey }` is the core idempotency guarantee.

### `LedgerEntry`

Double-entry bookkeeping. Every settled payment creates exactly one `DEBIT` for the sender and
one `CREDIT` for the receiver, each with the resulting balance. A unique index on
`{ transactionId, entryType }` prevents duplicate entries.

### `FraudAlert`

Created for MEDIUM/HIGH transactions. It stores the risk score/level, reasons and a
`status` of `OPEN` or `RESOLVED`. Administrators can work the alert queue independently of the
transaction list.

### `Device`

Known device fingerprints per user. A device seen for the first time raises the `NEW_DEVICE`
rule; later payments from it do not. This is a lightweight trust signal, not strong
authentication.

### `Review`

The audit record of an admin decision: reviewer, action (`APPROVE`/`REJECT`), reason and
timestamp. Unique per transaction, which helps prevent duplicate review records.

---

## 3. End-to-end request trace

This is the most useful section for understanding the backend. Follow a `POST /api/transactions`.

### Step 1 — HTTP boundary

`frontend` posts JSON to `backend/src/routes/transactionRoutes.js`. The route chain is:

1. `authenticate` middleware verifies the Bearer JWT and reloads the user from MongoDB.
2. `rateLimit` allows at most 30 transfers per 10 minutes per user.
3. `validate` runs the strict Zod `transferSchema` (integer amount, email, optional context).
4. `transactionController.create` extracts the `Idempotency-Key` header (or generates one) and
   calls the payment service.

The controller does no business logic. Its job is HTTP: read input, call a service, choose a
status code. New payments return `201`; replayed ones return `200` with
`Idempotency-Replayed: true`.

### Step 2 — Finding the wallets

`backend/src/services/paymentService.js` loads the sender wallet, the receiver user by email
and the receiver wallet. It rejects:

- a missing sender wallet (`404`),
- an inactive sender or receiver wallet (`422`),
- an unknown receiver email (`404`),
- a self-transfer (`400`).

### Step 3 — Idempotency before anything expensive

`idempotencyService.findIdempotentTransaction` first checks Redis, then MongoDB. The request
hash is computed from the receiver, amount, currency and description.

- Record exists with the **same** hash → return the original transaction as a replay.
- Record exists with a **different** hash → `409 IDEMPOTENCY_KEY_REUSED`.

This check happens before risk scoring, so replaying a request does not create new velocity
events or a second model call.

### Step 4 — Gathering risk features

Several independent lookups run in parallel:

- `velocityService.getVelocityFeatures` reads Redis sorted sets for the 10-minute and 1-hour
  windows and the failed-attempt counter for 15 minutes.
- `getAverageOutgoingAmount` averages the customer's last 20 completed outgoing transfers.
- `deviceService.isNewDevice` checks whether this `deviceId` was stored for this user.
- `detectUnusualLocation` compares the location with up to 20 recent payment locations. It
  only flags a difference after at least two historical payments, so a customer's first
  payments are not punished.

### Step 5 — Rules

`fraudRulesService.evaluateRules` returns a rule score and a list of reasons. Each reason has a
code, a human-readable message and a weight. The weights are additive and capped at 100.

Rules are deliberately explainable: an admin can see *why* a payment was flagged, not just a
number.

### Step 6 — ML prediction

`fraudPredictionService` maps the features to the FastAPI request shape and calls `/predict`
with a timeout. Possible outcomes:

- model returns a probability → `available: true`;
- service is unreachable/times out → `available: false`, no probability is invented;
- response is malformed → treated as unavailable and logged.

The payment continues with rules only in the unavailable case, and the transaction records
`mlAvailable=false` so the decision is auditable.

### Step 7 — Blended decision

`riskDecisionService.decideRisk` computes:

```text
mlScore    = round(probability × 100)
finalScore = round(mlScore × 0.6 + ruleScore × 0.4)
if ruleScore >= 70: finalScore = max(finalScore, ruleScore)
```

Then maps the score to LOW/MEDIUM/HIGH and the level to APPROVE/MANUAL_REVIEW/DECLINE.
`HIGH_RISK_ACTION` decides whether HIGH is reviewed or declined automatically.

### Step 8 — Recording and settling

The service opens a MongoDB session with `withTransaction`.

- LOW → transaction status starts as `APPROVED`, then `settleTransfer` runs in the same
  session:
  1. conditional debit `balance >= amount` (fails closed if funds are missing),
  2. credit the receiver,
  3. write the DEBIT ledger entry,
  4. write the CREDIT ledger entry,
  5. set the transaction to `COMPLETED`.
- MEDIUM/HIGH → transaction is created as `PENDING_REVIEW`; no balance is touched.
- Decline policy → transaction is created as `DECLINED`; no balance is touched.

The device fingerprint is upserted inside the same transaction.

If the unique idempotency index fires because of a race, the service loads the existing
transaction and returns it as a replay (or a `409` if the body differs). If the conditional
debit fails, the whole DB transaction rolls back and the API returns `422
INSUFFICIENT_FUNDS`.

### Step 9 — After commit

Post-commit work is wrapped in its own `try/catch` and must never turn a successful payment
into a failed HTTP response:

- record the transfer in the velocity window,
- record a failed attempt if the transaction was declined,
- store the idempotency mapping in Redis,
- create a `FraudAlert` for non-LOW risk,
- emit Socket.IO events to the sender, receiver (only if completed) and admins.

Finally the populated transaction is returned to the controller.

### Step 10 — Admin review

`adminReviewService` implements both outcomes with atomic claims:

- **Approve:** claim `PENDING_REVIEW → APPROVED` with `findOneAndUpdate`. Only the winner
  proceeds to settle inside a MongoDB transaction; the loser sees `REVIEW_ALREADY_PROCESSED`.
  Settlement reuses `settleTransfer`, writes the `Review`, resolves the alert and emits
  `transaction:reviewed`.
- **Reject:** claim `PENDING_REVIEW → DECLINED`, write the `Review`, set `declinedAt`, resolve
  the alert. No ledger entries or balance changes exist for a declined payment.

---

## 4. Why these guarantees matter

| Guarantee | Mechanism |
| --- | --- |
| No negative balances | Conditional `findOneAndUpdate` with `balance >= amount` |
| No half-finished transfers | Debit, credit, ledger and status change share one DB transaction |
| No duplicate settlement | Unique ledger index + state-machine claim before settling |
| No duplicate payment on retry | Unique `{senderId, idempotencyKey}` + request hash |
| No double approval | Atomic `PENDING_REVIEW → APPROVED` claim |
| Declined never moves money | Rejection path has no settlement call |
| Strong evidence not diluted | Final score floored at the rule score when rules are HIGH |
| Explained decisions | Rule reasons and ML provenance stored on the transaction |

A MongoDB **replica set** is required because multi-document transactions are not available on
a standalone server. Atlas provides this automatically; locally you can initialize a
single-node replica set (`rs.initiate`).

---

## 5. Backend directory tour (`backend/src`)

### `config/`

- **`env.js`** reads and validates environment variables once, with defaults. This is the only
  place that should read `process.env` for configuration.
- **`database.js`** connects Mongoose, exposes `isDatabaseConnected`, and handles graceful
  shutdown.
- **`redis.js`** creates the ioredis client. If Redis is unreachable it switches to in-process
  stores and reports `degraded`, so the API keeps working with reduced guarantees.

### `models/`

Mongoose schemas and indexes for the seven collections described above. Model files contain
field definitions, validation, indexes and small helpers such as safe user serialization.

### `routes/`

Express routers grouped by audience:

- `authRoutes.js` — register, login, profile.
- `accountRoutes.js` — wallet and ledger.
- `transactionRoutes.js` — create/list/detail/risk, all customer-scoped.
- `adminRoutes.js` — dashboard, transactions, alerts, analytics, approve/reject; the whole
  router is protected by `authenticate` + `authorize('admin')`.
- `index.js` — mounts everything under `/api` and exposes `/health`.

Routes stay thin: middleware, validation and a controller call.

### `middleware/`

- **`authMiddleware.js`** verifies the JWT and reloads the user, so a role change takes effect
  immediately and deleted users cannot keep using an old token.
- **`validate.js`** applies Zod schemas to `body`, `query` and `params` and returns structured
  validation errors.
- **`rateLimiter.js`** implements Redis-backed counters with a safe in-process fallback.
- **`errorHandler.js`** converts `ApiError`, Zod and Mongoose errors into the standard error
  envelope; unknown errors become `500` without leaking internals.

### `controllers/`

HTTP adapters. They read request data, call one or more services, and call `sendSuccess`.
Examples:

- `transactionController.js` handles idempotency-key extraction and replay status codes.
- `adminController.js` exposes dashboard/analytics and review actions.
- `healthController.js` reports the real DB/Redis state.

### `services/`

The heart of the application:

| File | Responsibility |
| --- | --- |
| `authService.js` | Register (customer + wallet in one transaction), login, profile |
| `tokenService.js` | JWT sign/verify |
| `paymentService.js` | Full transfer orchestration and settlement |
| `transactionService.js` | Customer listing/detail queries and populate paths |
| `transactionStateService.js` | Allowed status transitions |
| `idempotencyService.js` | Redis fast path + MongoDB durable replay/conflict |
| `velocityService.js` | Sliding windows, failed attempts, success recording |
| `deviceService.js` | Device trust/newness |
| `fraudRulesService.js` | Weighted explainable rules |
| `fraudPredictionService.js` | FastAPI HTTP client and fallback handling |
| `riskDecisionService.js` | Blend, thresholds and policy |
| `ledgerService.js` | Ledger reads/aggregation for the UI |
| `accountService.js` | Wallet lookup and serialization |
| `adminReviewService.js` | Approve/reject with atomic state claims |
| `adminAnalyticsService.js` | Dashboard metrics, distributions, series |
| `adminFraudService.js` | Alert queue queries |
| `transactionPresenter.js` | Stable API response shapes for transactions/alerts |

### `validators/`

Strict Zod schemas for auth and transaction/admin input. `.strict()` rejects unknown keys, so
for example a registration body cannot smuggle in `role: "admin"`. Amounts must be positive
integers in paise. Review reasons are 3–500 characters.

### `sockets/`

- `index.js` creates the Socket.IO server, verifies the handshake JWT, reloads the user role
  and joins `user:<id>` (plus `admins`).
- `socketRegistry.js` holds the server reference and helpers `emitToUser` / `emitToAdmins`.
  Services depend on these helpers rather than the whole Socket.IO object.

### `utils/`

- `ApiError.js` — typed operational errors with status/code/details.
- `apiResponse.js` — the `{ success, data }` / `{ success, error }` envelope.
- `asyncHandler.js` — forwards async errors to Express.
- `ids.js` — public transaction IDs, request hashing and INR formatting.

### `scripts/`

- `seed.js` — idempotent demo data (admin + two customers + simulated wallets).
- `initReplicaSet.js` — local single-node replica-set initializer.

---

## 6. Fraud service tour (`fraud-service`)

### `app/schemas.py`

Pydantic request/response models. The request schema uses `extra="forbid"`, so the API fails
fast if the backend sends an unexpected feature. This keeps training and inference shapes in
sync.

### `app/preprocessing.py`

Loads the fitted preprocessing pipeline and turns a request into the model's feature matrix.
The same Joblib artifact is used in training and serving — the single most important rule for
avoiding training/serving skew.

### `app/predict.py`

Loads the model artifacts at startup and exposes a `predict` function. If artifacts are
missing or fail to load, it uses a deterministic rule-only fallback and marks the response
`fallback: true`. It never pretends the model ran.

### `app/main.py`

FastAPI application with `POST /predict`, `GET /health` and `/docs`. `/health` reports whether
a model is loaded, its type/version and whether fallback mode is active.

### `training/`

- `synthetic.py` generates PaySim-style synthetic transactions with a configurable fraud rate.
- `train.py` builds the preprocessing pipeline, trains the RandomForest with balanced class
  weights, evaluates on a held-out split and saves Joblib artifacts plus metadata.
- `evaluate.py` recomputes and writes `models/metrics.json`.
- `samples/synthetic_sample.csv` is a small inspectable sample, not the full dataset.

The reported metrics are measured on **synthetic data** and should be read as a demonstration
of the pipeline, not as evidence of real-world fraud performance.

---

## 7. Frontend tour (`frontend/src`)

### `main.jsx` and `App.jsx`

Boot the React app and define routes. `ProtectedRoute` checks authentication and optionally
the role; unauthenticated users are redirected to `/login`, customers away from `/admin`, and
unknown routes to the not-found page.

### `context/`

- **`AuthContext.jsx`** stores the JWT and user in `localStorage`, restores the session on
  load, exposes `login`/`register`/`logout`, and listens for `401` events from Axios.
- **`RealtimeContext.jsx`** connects to Socket.IO with the current token, reloads data on
  events and maintains the notification list. The effect keys on `user?.id` and `user?.role`
  so reconnects happen when the session changes.
- **`ToastContext.jsx`** provides success/error toasts used across the app.

### `services/`

- **`api.js`** creates the Axios instance (`VITE_API_URL` default `/api`), attaches the Bearer
  token, normalizes API errors into `{ message, details, code }`, and emits an unauthorized
  event after auth failures.
- **`socket.js`** creates the Socket.IO client pointed at `VITE_SOCKET_URL` (or the page
  origin when empty).

### `hooks/`

- `useAsyncData` handles loading/error/data/reload for page-level fetches.
- `useDocumentTitle` keeps the browser tab title meaningful.

### `components/`

- **`layout/`** — sidebar, topbar (search, notifications, account menu), brand, protected
  route, app shell.
- **`ui/`** — reusable Button, Input, Select, Card, Badge, Modal, ConfirmDialog, Pagination,
  Skeleton, ErrorState, EmptyState, StatCard, PageHeader, FullPageLoader.
- **`transactions/`** — status/risk badges, risk score bar, risk reasons list, transaction
  table.
- **`charts/`** — Recharts wrappers for volume, status, risk distribution, rule frequency,
  amount buckets and activity.
- **`auth/AuthShell.jsx`** — the shared split layout for login/register.

### `pages/`

- `auth/` — Login and Register.
- `customer/` — Dashboard, Transfer, Transactions, Transaction detail.
- `admin/` — Dashboard, All transactions, Fraud alerts, Investigation, Analytics.
- `ProfilePage.jsx` — user details, wallet, ledger, security notes.
- `NotFoundPage.jsx`.

Pages fetch from real APIs; there are no hardcoded dashboard values. Loading, error and empty
states are handled explicitly.

### `utils/`

- `format.js` — INR, dates, percentages, initials, relative time.
- `constants.js` — status/risk/decision metadata shared by badges and filters.
- `device.js` — generates and persists a browser device identifier used for risk context.
- `cn.js` — class-name joining helper.

---

## 8. Realtime behavior

1. After login/restore, `RealtimeContext` connects with the JWT.
2. The server verifies the token, reloads the user and joins `user:<id>` (admins also join
   `admins`) and emits `socket:ready`.
3. On a payment or review, backend services emit targeted events.
4. The SPA reloads the relevant page data and adds a notification; it does not mutate balances
   from the event payload.
5. On reconnect the SPA refetches, so a missed event cannot leave stale money on screen.

REST is the source of truth. Socket.IO is a freshness enhancement.

---

## 9. Security and failure design

- Registration always creates a `customer`; admin creation is limited to the seed script.
- Admin middleware reloads the role from MongoDB, so hiding UI is not the security boundary.
- JWT secrets, Mongo URIs, Redis URLs and seed passwords come from environment variables.
- Passwords are bcrypt-hashed with 12 rounds and never returned by the API.
- Zod strict schemas reject unknown fields and malformed amounts.
- Rate limiting protects credential endpoints, transfers and review actions.
- Socket rooms are per-user; no global broadcast exists.
- Redis down → in-process fallback, health reports `degraded`.
- ML down → rules-only scoring, `mlAvailable=false`.
- Post-commit bookkeeping failures are logged, not turned into false payment failures.
- If the database write fails, the MongoDB transaction rolls back; money is never partially
  moved.

Known scope limits: no KYC, email verification, password reset, refresh tokens, 2FA, real
banking integration, or automated model retraining. The ML model is trained on synthetic data.

---

## 10. Where to change things

| Goal | Start here |
| --- | --- |
| Change rule weights or add a rule | `backend/src/services/fraudRulesService.js` |
| Change score blending or thresholds | `backend/src/services/riskDecisionService.js`, `backend/src/config/env.js` |
| Change transfer validation | `backend/src/validators/transactionSchemas.js` |
| Change settlement behavior | `backend/src/services/paymentService.js`, `adminReviewService.js` |
| Add an API endpoint | matching file in `backend/src/routes/` + controller + service |
| Change ML features | `fraud-service/app/schemas.py`, `app/preprocessing.py`, `training/train.py` |
| Change the UI theme or navigation | `frontend/src/index.css`, `components/layout/`, `utils/constants.js` |
| Add a dashboard panel | corresponding page in `frontend/src/pages/` + a chart component |

When changing a feature used by both training and inference, update both sides and retrain the
model. Keep money as integer paise everywhere in the backend and convert only at the UI edge.
