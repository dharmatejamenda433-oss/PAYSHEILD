# PayShield — Intelligent Payment Fraud Detection & Risk Management

PayShield is a portfolio-grade, **fully simulated** fintech platform that demonstrates how a
payment system and a fraud-risk pipeline can work together end to end.

A customer sends an internal INR transfer. The backend applies Redis-backed velocity checks,
deterministic fraud rules and a scikit-learn model, then produces a risk score and a business
decision. Low-risk payments settle immediately; medium- and high-risk payments wait for an
administrator. Approval moves money atomically through a double-entry ledger; rejection never
moves money. Every dashboard number is read from the real APIs.

> **Simulation notice:** All payments, balances and ledgers are simulated. This repository
> contains no real banking integration, no card data and no production credentials. Demo
> credentials in this README are development-only values.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Quick start with Docker Compose](#quick-start-with-docker-compose)
- [Local development](#local-development)
- [Demo accounts](#demo-accounts)
- [End-to-end walkthrough](#end-to-end-walkthrough)
- [Payment lifecycle and state machine](#payment-lifecycle-and-state-machine)
- [Fraud risk engine](#fraud-risk-engine)
- [Machine-learning service](#machine-learning-service)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Realtime Socket.IO events](#realtime-socketio-events)
- [Testing and observed results](#testing-and-observed-results)
- [Design decisions](#design-decisions)
- [Security notes and limitations](#security-notes-and-limitations)
- [Troubleshooting](#troubleshooting)
- [Further reading](#further-reading)

---

## Features

### Customer

- Registration with a simulated wallet, login, JWT session and profile page.
- Wallet dashboard with balance, recent activity, monthly volume and risk summary.
- Transfer form with contact lookup, idempotency key, device/location context and confirmation.
- Transaction history with status, risk-level, amount and date filters plus pagination.
- Transaction detail with risk reasons, ML probability, review outcome and ledger impact.
- Live Socket.IO updates and in-app notifications.

### Administrator

- Role-gated admin area (enforced on the backend, not only in the UI).
- Operational dashboard: total transactions, settled volume, success/flag counts, pending
  reviews, decline and fraud rates, risk mix, daily volume and suspicious transactions.
- All-transactions view with the same filters plus status/risk summaries.
- Fraud-alert queue and investigation workspace with rules, model output, account context and
  one-click approve/reject with a mandatory review note.
- Analytics: status distribution, risk distribution, rule frequency, amount buckets, ML
  coverage and average probability.

### Platform

- Atomic money movement: conditional `balance >= amount` debit, matching credit, two ledger
  entries, all inside one MongoDB transaction.
- Durable idempotency: replaying the same `Idempotency-Key` with the same body returns the
  original transaction; reusing a key with a different body returns `409`.
- Redis sliding-window velocity, failed-attempt counters, rate limiting and idempotency cache,
  with an in-process fallback when Redis is down.
- Hybrid rules + ML risk decision with configurable thresholds and policy.
- Health endpoint that reports database and Redis state honestly.
- React SPA with skeletons, empty states, error states, toast notifications and confirmation
  dialogs.

---

## Architecture

```text
                        ┌──────────────────────────────┐
                        │      React SPA (Vite)        │
                        │  customer + admin dashboards │
                        │  Axios REST + Socket.IO      │
                        └──────────────┬───────────────┘
                                       │ HTTPS / WS
                        ┌──────────────▼───────────────┐
                        │      Express API (Node)      │
                        │ auth · payments · admin      │
                        │ state machine · idempotency  │
                        └───┬──────────┬──────────┬────┘
                            │          │          │
              ┌─────────────▼──┐  ┌────▼─────┐  ┌─▼─────────────────┐
              │ MongoDB rs0    │  │  Redis   │  │ Python FastAPI    │
              │ users/accounts │  │ velocity │  │ /predict          │
              │ transactions   │  │ limits   │  │ rules + ML blend  │
              │ ledger/alerts  │  │ idem.    │  │ RandomForest      │
              └────────────────┘  └──────────┘  └───────────────────┘
```

### Request flow for a transfer

1. The SPA posts `POST /api/transactions` with a UUID `Idempotency-Key`.
2. Express authenticates the JWT and validates the body with Zod.
3. The payment service checks the idempotency record and request hash.
4. It loads both wallets in a MongoDB session and rejects invalid/inactive/self transfers.
5. Redis records the attempt and returns 10-minute and 1-hour velocity counts plus failed
   attempts in the last 15 minutes.
6. `fraudRulesService` produces weighted, human-readable reasons and a rule score.
7. `fraudPredictionService` calls FastAPI `/predict`; a timeout falls back to rules only and is
   labelled as such.
8. `riskDecisionService` blends both scores, maps the result to `LOW`/`MEDIUM`/`HIGH` and
   selects `APPROVE`, `MANUAL_REVIEW` or `DECLINE`.
9. LOW payments settle inside the transaction: debit, credit, two ledger entries, status
   `COMPLETED`. Review payments are written as `PENDING_REVIEW` with no money movement.
10. Socket.IO notifies the sender, receiver and administrators.
11. The API returns the created transaction (or the original one on a replay).

Approval later claims the transaction atomically (`PENDING_REVIEW → APPROVED`), moves money
and writes ledger entries plus a `Review` record. Rejection only writes the review and marks
the transaction `DECLINED`.

For a file-by-file, beginner-friendly tour see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite, React Router, Tailwind CSS 4, Axios, Recharts, Socket.IO Client, Lucide |
| Backend | Node.js 24 (ES modules), Express, MongoDB + Mongoose, Redis (ioredis), JWT, bcryptjs, Zod, Socket.IO |
| Fraud service | Python 3.12+, FastAPI, Pydantic, pandas, NumPy, scikit-learn, Joblib, pytest |
| Infrastructure | Docker, Docker Compose, MongoDB single-node replica set, Redis 7, nginx |

---

## Repository layout

```text
.
├── backend/                 Express API, tests and seed scripts
│   ├── src/
│   │   ├── config/          env, Mongo and Redis connections
│   │   ├── controllers/     HTTP layer
│   │   ├── middleware/      auth, validation, rate limits, errors
│   │   ├── models/          User, Account, Transaction, LedgerEntry, FraudAlert, Device, Review
│   │   ├── routes/          /api route groups
│   │   ├── services/        payment, risk, ML client, ledger, reviews, analytics
│   │   ├── sockets/         authenticated Socket.IO rooms
│   │   ├── utils/           API response, errors, IDs
│   │   └── validators/      Zod schemas
│   └── tests/               Jest API tests + in-memory Mongo replica set
├── fraud-service/           FastAPI prediction service
│   ├── app/                 schemas, preprocessing, model loading, routes
│   ├── training/            synthetic data generator, training and evaluation
│   ├── models/              trained Joblib pipeline + metrics metadata
│   └── tests/               pytest API tests
├── frontend/                React SPA
│   └── src/
│       ├── components/      auth, layout, charts, transactions, UI primitives
│       ├── context/         auth, realtime, toasts
│       ├── hooks/           async data and document title
│       ├── pages/           auth, customer, admin, profile
│       ├── services/        Axios client and Socket.IO client
│       └── utils/           constants, formatting, device identity
├── infra/mongo-init.sh      initiates the single-node replica set
├── docs/ARCHITECTURE.md     beginner-friendly architecture walkthrough
├── docker-compose.yml       frontend, backend, fraud service, Redis, MongoDB
└── .env.example             optional Compose overrides
```

---

## Quick start with Docker Compose

### Prerequisites

- Docker Engine with the Compose plugin (or Docker Desktop).
- Ports `8080` (frontend), `5000` (API) and `8000` (fraud service) free.

### Steps

```bash
git clone https://github.com/dharmatejamenda433-oss/PAYSHEILD.git
cd PAYSHEILD
cp .env.example .env          # optional: set a strong JWT_SECRET
docker compose up --build -d
docker compose exec backend npm run seed
```

Open <http://localhost:8080>. The API is at <http://localhost:5000/api/health> and the fraud
service at <http://localhost:8000/health>.

The Compose stack starts:

| Service | Role | Host port |
| --- | --- | --- |
| `frontend` | nginx serving the built SPA and proxying `/api` and `/socket.io` | 8080 |
| `backend` | Express API | 5000 |
| `fraud-service` | FastAPI model server | 8000 |
| `redis` | velocity counters, rate limits, idempotency cache | internal |
| `mongo` | MongoDB 7 replica set `rs0` | internal |
| `mongo-init` | one-shot replica-set initializer | — |

MongoDB is intentionally not exposed to the host; the backend reaches it over the Compose
network. Set `JWT_SECRET` in `.env` before exposing the stack beyond your machine.

> **Verified status:** `docker compose config --quiet` passes. The images were **not built or
> run** during verification because the Docker daemon was unavailable on the development
> machine. Local (non-Docker) startup and the full browser workflow were exercised instead.

---

## Local development

### Prerequisites

- Node.js 20+ (verified on Node 24).
- MongoDB running as a replica set. Multi-document transactions are required.
- Redis 7 (optional; the API logs a warning and uses an in-process fallback if absent).
- Python 3.10+ (verified on 3.13).

### 1. MongoDB replica set

Use MongoDB Atlas, or start a local single-node replica set. `backend/.env.example` points at
`mongodb://127.0.0.1:27017/payshield?replicaSet=rs0`; the commands below use port `27018` so
they do not collide with a standalone MongoDB that is often already running on `27017`.

```bash
# Example: local mongod on port 27018
mongod --replSet rs0 --port 27018 --dbpath ./.local/mongo --bind_ip 127.0.0.1
# In another shell:
mongosh --port 27018 --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27018"}]})'
```

An existing standalone server on `27017` will **not** support transactions. Either add it to a
replica set or point `MONGODB_URI` at a replica-set deployment.

### 2. Fraud service

```bash
cd fraud-service
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

If `models/fraud_model.joblib` is missing, retrain it:

```bash
python -m training.train
python -m training.evaluate
```

The service intentionally returns a deterministic, rule-only fallback when no model is
present. That fallback is labelled `fallback: true` in the response and is **not** a trained
prediction.

### 3. Backend

```bash
cd backend
cp .env.example .env               # edit MONGODB_URI / JWT_SECRET if needed
npm install
npm run seed
npm run dev                        # http://localhost:5000
```

The seed script is safe to re-run: it creates the admin, `asha@example.com`,
`ravi@example.com` and gives each customer a simulated ₹100,000 wallet
(`DEMO_BALANCE_PAISE=10000000`) when the account does not already exist.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

`frontend/.env` (optional):

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

The default `npm run build` output can be served by any static host. When served behind the
included nginx config, use `VITE_API_URL=/api` and leave `VITE_SOCKET_URL` empty so the SPA
uses the same origin.

---

## Demo accounts

Created by `npm run seed` (development only — change them before any public deployment):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@payshield.dev` | `Admin@12345` |
| Customer | `asha@example.com` | `Customer@123` |
| Customer | `ravi@example.com` | `Customer@123` |

New registrations receive a simulated ₹50,000 wallet (`STARTING_BALANCE_PAISE=5000000`).
Seeded demo customers receive ₹100,000 so review scenarios are easy to reproduce.

---

## End-to-end walkthrough

1. Sign in as Asha and send ₹500 to Ravi. The payment completes with a LOW score.
2. Send several payments quickly, or send a large share of the wallet balance, to accumulate
   velocity and amount rules.
3. A sufficiently large/fast transfer becomes `PENDING_REVIEW` with a HIGH score and no money
   movement.
4. Sign in as the admin, open **Fraud alerts** or the transaction, read the rule reasons and ML
   probability, then approve or reject with a note.
5. Approval settles the transfer atomically and updates both balances and the ledger.
   Rejection marks it `DECLINED` and leaves balances untouched.
6. Return to the customer dashboard: balance, status, risk and ledger all reflect the result.

During verification this flow was exercised in a real browser against the running APIs,
including a ₹50,000 HIGH-risk payment held for review, one rejection and one approval with
subsequent balance/ledger confirmation. See [Testing and observed results](#testing-and-observed-results).

---

## Payment lifecycle and state machine

Statuses are explicit; arbitrary transitions are rejected by `transactionStateService`.

```text
                 ┌──────────────┐
   LOW risk ────►│  COMPLETED   │  (settled immediately)
                 └──────────────┘

                 ┌──────────────┐   approve    ┌──────────┐   settle   ┌──────────────┐
   MEDIUM/HIGH ─►│ PENDING_     │─────────────►│ APPROVED │───────────►│  COMPLETED   │
                 │ REVIEW       │              └──────────┘            └──────────────┘
                 └──────┬───────┘
                        │ reject
                        ▼
                 ┌──────────────┐
                 │  DECLINED    │  (no balance or ledger changes)
                 └──────────────┘

   any pre-settlement processing failure ───► FAILED
```

| Status | Meaning | Money moved? |
| --- | --- | --- |
| `PENDING_REVIEW` | Awaiting an administrator | No |
| `APPROVED` | Claimed by a reviewer, being settled | No (transient) |
| `COMPLETED` | Settled successfully | Yes |
| `DECLINED` | Rejected or declined by policy | No |
| `FAILED` | Processing error | No |

Guarantees:

- The sender debit is a conditional atomic update (`balance >= amount`), so balances can never
  go negative under concurrency.
- Debit and credit occur inside one MongoDB transaction with two unique ledger entries
  (`{transactionId, entryType}` unique).
- Only an administrator approval can settle a `PENDING_REVIEW` payment.
- Review actions are atomic: two simultaneous approvals cannot both settle. The loser receives
  `REVIEW_ALREADY_PROCESSED`.
- A declined transaction has `declinedAt` and no `completedAt`; a settled one has
  `completedAt` and no `declinedAt`.

---

## Fraud risk engine

### Deterministic rules

Each triggered rule contributes a weight; weights are additive and capped at 100. Rules also
return human-readable messages stored with the transaction and shown in the UI.

| Code | Weight | Trigger |
| --- | --- | --- |
| `LARGE_AMOUNT` | 25 | Amount ≥ `LARGE_AMOUNT_THRESHOLD_PAISE` (default ₹25,000) |
| `LARGE_SHARE_OF_BALANCE` | 20 | Amount ≥ 70% of the wallet balance (and ≥ ₹1,000) |
| `ABOVE_USUAL_AMOUNT` | 20 | Amount ≥ 4× the customer's 30-day average (avg ≥ ₹1,000) |
| `VELOCITY_10M` | 25 / 15 | 5+ attempts in 10 min (25), or 3–4 attempts (15) |
| `VELOCITY_1H` | 15 | 10+ attempts in 1 hour |
| `NEW_DEVICE` | 15 | Device fingerprint not seen for this user |
| `UNUSUAL_LOCATION` | 20 | Location differs from recent locations |
| `FAILED_ATTEMPTS` | 15 | 3+ failed attempts in 15 minutes |

### Hybrid score and thresholds

```text
finalScore = round(mlProbability × 100 × ML_WEIGHT + ruleScore × RULE_WEIGHT)
if ruleScore >= RISK_HIGH_THRESHOLD:
    finalScore = max(finalScore, ruleScore)   # strong deterministic evidence is not diluted
if ML is unavailable:
    finalScore = ruleScore
```

Defaults: `ML_WEIGHT=0.6`, `RULE_WEIGHT=0.4`, medium threshold `30`, high threshold `70`.

| Final score | Level | Decision |
| --- | --- | --- |
| 0–29 | LOW | `APPROVE` (settles immediately) |
| 30–69 | MEDIUM | `MANUAL_REVIEW` |
| 70–100 | HIGH | `MANUAL_REVIEW`, or `DECLINE` when `HIGH_RISK_ACTION=decline` |

The decision, score, reasons, ML probability and ML availability are persisted on the
transaction and returned by the API. If the Python service is unreachable, the payment still
proceeds using rules only, and `mlAvailable=false` records that fact instead of inventing a
probability.

---

## Machine-learning service

- Model: `RandomForestClassifier` with `class_weight="balanced"` inside a scikit-learn
  `Pipeline`.
- Preprocessing: `StandardScaler` for numeric features and `OneHotEncoder` for transaction
  type, fitted once and reused for training and inference.
- Training data: **synthetic PaySim-style data generated locally** (120,000 samples, 2.03%
  fraud). The generator is in `fraud-service/training/synthetic.py`.

### Features

`amount`, `transaction_type`, `transaction_count_10m`, `transaction_count_1h`,
`is_new_device`, `is_unusual_location`, `failed_attempts_15m`, `hour_of_day`, `day_of_week`,
`avg_amount_30d`, `amount_to_balance_ratio`.

### Measured metrics on the synthetic test split

Source: `fraud-service/models/metrics.json` (24,000 test samples, 488 fraud cases). These
numbers describe **synthetic data only** and are not a claim about real-world performance.

| Metric | Value |
| --- | --- |
| Accuracy | 0.973625 |
| Precision | 0.410824 |
| Recall | 0.684426 |
| F1 | 0.513451 |
| ROC-AUC | 0.976136 |
| PR-AUC | 0.536616 |
| Confusion matrix (TN / FP / FN / TP) | 23,033 / 479 / 154 / 334 |

The relatively low precision is expected for imbalanced fraud data and is left visible rather
than optimised away. Retrain with:

```bash
cd fraud-service
python -m training.train
python -m training.evaluate
```

`/health` reports the loaded model type/version; `/predict` includes `model_type`, `fallback`,
`threshold` and a note. Missing model files produce the clearly labelled rule-only fallback.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | HTTP port |
| `NODE_ENV` | `development` | Runtime mode |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/payshield?replicaSet=rs0` | MongoDB replica-set URI |
| `JWT_SECRET` | — (required) | Token signing secret, at least 32 chars |
| `JWT_EXPIRES_IN` | `1d` | Access-token lifetime |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection |
| `FRAUD_SERVICE_URL` | `http://127.0.0.1:8000` | FastAPI base URL |
| `FRAUD_SERVICE_TIMEOUT_MS` | `2500` | ML request timeout |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS/WebSocket origin(s), comma-separated |
| `STARTING_BALANCE_PAISE` | `5000000` | New customer wallet (₹50,000) |
| `RISK_MEDIUM_THRESHOLD` | `30` | MEDIUM lower bound |
| `RISK_HIGH_THRESHOLD` | `70` | HIGH lower bound |
| `HIGH_RISK_ACTION` | `review` | `review` or `decline` |
| `ML_WEIGHT` | `0.6` | ML contribution |
| `RULE_WEIGHT` | `0.4` | Rule contribution |
| `LARGE_AMOUNT_THRESHOLD_PAISE` | `2500000` | Large-amount rule (₹25,000) |
| `IDEMPOTENCY_TTL_SECONDS` | `86400` | Redis idempotency cache TTL |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@payshield.dev` / `Admin@12345` | Seed admin |
| `SEED_CUSTOMER_PASSWORD` | `Customer@123` | Seeded customer password |
| `DEMO_BALANCE_PAISE` | `10000000` | Seeded demo wallet (₹100,000) |

### Frontend (`frontend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `/api` | REST base URL |
| `VITE_SOCKET_URL` | empty (same origin) | Socket.IO origin |

### Fraud service (`fraud-service/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `MODEL_PATH` | `models` | Directory with Joblib artifacts |
| `FRAUD_THRESHOLD` | `0.5` | Probability reported as `FRAUD` |

### Compose-only overrides (root `.env`)

`JWT_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_PASSWORD`. See
`.env.example`. Never commit a real `.env`; it is ignored by Git.

---

## API reference

Base URL: `http://localhost:5000/api` (or `/api` behind the included nginx proxy).

All responses use one envelope:

```json
{ "success": true, "data": { } }
```

```json
{
  "success": false,
  "error": { "code": "INSUFFICIENT_FUNDS", "message": "…", "details": [] }
}
```

Authenticated routes require `Authorization: Bearer <token>`.

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | Public | DB/Redis/uptime status; `200` when DB is connected, else `503` |

Example:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "redis": "connected",
    "uptimeSeconds": 123,
    "timestamp": "2026-11-05T00:00:00.000Z"
  }
}
```

### Authentication

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | `{ name, email, password }` |
| POST | `/auth/login` | Public | `{ email, password }` |
| GET | `/auth/profile` | Bearer | — |

Register returns `201` with `{ user, account, token }`. Login returns the same shape. The role
is always forced to `customer` on registration; the schemas are strict and reject extra fields
such as `role`. Passwords need 8–72 characters with at least one letter and one number. Auth
routes are rate-limited to 50 requests per 15 minutes per IP.

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"asha@example.com","password":"Customer@123"}'
```

### Accounts and ledger

| Method | Path | Auth | Query |
| --- | --- | --- | --- |
| GET | `/accounts/me` | Bearer | — |
| GET | `/accounts/me/ledger` | Bearer | `page`, `limit` |

`/accounts/me` returns the simulated wallet. `/accounts/me/ledger` returns the signed ledger
entries for that wallet, newest first, with transaction metadata.

### Transactions (customer)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/transactions` | Bearer | Create an internal transfer |
| GET | `/transactions` | Bearer | List own transactions |
| GET | `/transactions/:id` | Bearer | Detail by Mongo ID or public `transactionId` |
| GET | `/transactions/:id/risk` | Bearer | Transaction + risk + alert + review bundle |

Transfer body:

```json
{
  "receiverEmail": "ravi@example.com",
  "amount": 50000,
  "description": "Lunch split"
}
```

`amount` is an **integer number of paise** (`50000` = ₹500). The body is strict; unknown fields
are rejected. Optional risk context is sent as headers: `X-Device-Id` (browser device
fingerprint) and `X-Client-Location` (for example `Mumbai, IN`), used by the device and
location rules.

Idempotency: supply an `Idempotency-Key` header (the UI generates a UUID). The same key with
the same body returns `200` and `{ transaction, replay: true }` with
`Idempotency-Replayed: true`; the same key with a different body returns
`409 IDEMPOTENCY_KEY_REUSED`. A new transfer returns `201` with `{ transaction, replay: false }`.

List query parameters (all optional): `page`, `limit`, `status`, `riskLevel`, `minAmount`,
`maxAmount`, `from`, `to`. `status` accepts `PENDING_REVIEW`, `APPROVED`, `COMPLETED`,
`DECLINED`, `FAILED`. Pagination metadata is returned in `meta`.

Example:

```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "X-Device-Id: demo-device-uuid" \
  -H "X-Client-Location: Mumbai, IN" \
  -d '{"receiverEmail":"ravi@example.com","amount":50000,"description":"Lunch"}'
```

### Admin (role `admin` required)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/dashboard` | Metrics, 7-day volume and recent suspicious transactions |
| GET | `/admin/transactions` | All transactions with customer filters |
| GET | `/admin/fraud-alerts` | Alert queue (`status`, `riskLevel`, `page`, `limit`) |
| GET | `/admin/analytics` | Status/risk/rule/amount/ML aggregates |
| POST | `/admin/reviews/:id/approve` | Settle a pending payment |
| POST | `/admin/reviews/:id/reject` | Decline a pending payment |

Approve/reject body:

```json
{ "reason": "Verified with the customer by phone." }
```

The reason is required and must be 3–500 characters. Both endpoints are rate-limited to 60
requests per minute per admin. Approve returns the settled transaction; reject returns the
declined transaction. Both resolve the associated fraud alert.

Common error codes include `VALIDATION_ERROR`, `INVALID_IDENTIFIER`, `INSUFFICIENT_FUNDS`,
`ACCOUNT_INACTIVE`, `RECEIVER_ACCOUNT_UNAVAILABLE`, `IDEMPOTENCY_KEY_REUSED`,
`REVIEW_NOT_PENDING`, `REVIEW_ALREADY_PROCESSED`, `RATE_LIMITED`, `FORBIDDEN`,
`UNAUTHORIZED` and `INTERNAL_SERVER_ERROR`.

### Fraud service API

| Method | Path | Description |
| --- | --- | --- |
| POST | `/predict` | Score one transaction |
| GET | `/health` | Model availability, type and version |
| GET | `/docs` | Interactive OpenAPI documentation |

`/predict` request (major INR units; `extra="forbid"`):

```json
{
  "amount": 50000,
  "transaction_type": "TRANSFER",
  "transaction_count_10m": 2,
  "transaction_count_1h": 4,
  "is_new_device": true,
  "is_unusual_location": false,
  "failed_attempts_15m": 0,
  "hour_of_day": 14,
  "day_of_week": 3,
  "avg_amount_30d": 2500,
  "amount_to_balance_ratio": 0.65
}
```

Response: `fraud_probability`, `risk_score`, `prediction`, `model_type`, `fallback`,
`threshold`, `model_version`, `note`.

---

## Realtime Socket.IO events

The client connects with `auth: { token }`. The server verifies the JWT, loads the current
role from MongoDB and joins only `user:<id>` (plus `admins` for administrators). No event is
broadcast globally.

| Event | Recipient | Payload |
| --- | --- | --- |
| `socket:ready` | Connecting socket | `{ userId, role }` |
| `transaction:created` | Sender, receiver, admins | Transaction summary + status |
| `transaction:reviewed` | Sender, receiver, admins | Review result + status |
| `fraud:alert` | Admins | Fraud alert summary |

The SPA reloads the visible data and adds a notification when these events arrive. REST
remains the source of truth; events are an enhancement, not a replacement.

---

## Testing and observed results

These are actual results from the development machine, not projections.

| Check | Command | Observed result |
| --- | --- | --- |
| Backend API tests | `cd backend && npm test` | **16 / 16 passing** (Jest, in-memory Mongo replica set; ~19 s) |
| Fraud service tests | `cd fraud-service && pytest -q` | **18 passing** |
| Frontend production build | `cd frontend && npm run build` | **Succeeded** — 2,573 modules, ~942 kB JS, ~54 kB CSS |
| Compose configuration | `docker compose config --quiet` | **Valid** |
| Container build/run | `docker compose up` | **Not executed** — Docker daemon unavailable |
| Browser workflow | Manual browser automation against the running stack | **Passed** (see below) |

The backend suite covers registration/login, role enforcement, transfer settlement, idempotent
replay and conflict, insufficient funds, atomic admin approval/rejection, and balance/ledger
integrity. The frontend production build reports a chunk-size warning (the single JS bundle is
large); this does not fail the build.

Observed browser workflow (real APIs, no mocked responses):

- LOW-risk ₹500 and ₹30,000 transfers completed and debited/credited correctly.
- Rapid transfers triggered velocity reasons and progressively higher scores.
- ₹50,000 and ₹45,000 transfers were held as `PENDING_REVIEW` with HIGH scores, correct rule
  reasons and real ML probabilities.
- Admin rejection marked the payment `DECLINED`, resolved its alert and left balances unchanged.
- Admin approval settled a held payment, moved exactly the transfer amount, wrote both ledger
  entries and resolved the alert.
- Customer and admin dashboards, alert queue, analytics and ledger views all reflected these
  operations.
- Idempotency replay returned the original transaction; key reuse with a different body
  returned `409`; insufficient funds returned `422` without changing balances.

To rerun locally:

```bash
cd backend && npm test
cd ../fraud-service && pytest -q
cd ../frontend && npm run build
```

The backend tests use `mongodb-memory-server`; the first run downloads a MongoDB binary. Run
the suite on its own if your machine is simultaneously running heavy builds — the in-memory
instance has a 10-second startup budget.

---

## Design decisions

- **Integer paise everywhere.** INR is stored as integer minor units to avoid floating-point
  money errors; the UI converts only for display.
- **MongoDB transaction + conditional update.** The debit uses `findOneAndUpdate` with
  `balance >= amount`, which prevents negative balances even if two requests race. The credit
  and ledger writes share the same session.
- **Durable idempotency over cache-only.** Redis is a fast path; a unique
  `{senderId, idempotencyKey}` index plus a SHA-256 request hash is the durable truth. The 409
  on key reuse protects clients from silently sending a different payment.
- **Explicit state machine.** Review statuses are not booleans. Approval claims
  `PENDING_REVIEW → APPROVED` atomically before settling, so double approval is impossible.
- **Rules are explainable; ML complements them.** A confident model cannot dilute strong
  deterministic evidence because the final score is floored at the rule score when the rule
  score is HIGH.
- **Honest degradation.** If Redis is down the API uses an in-process store and reports
  `degraded`; if ML is down payments score on rules only and record `mlAvailable=false`. No
  fake success or invented probability is returned.
- **Backend-enforced roles.** Admin routes require the role loaded fresh from the database;
  changing a JWT or hiding a nav item is not enough to gain access.
- **Synthetic data is labelled.** The model metrics are from locally generated PaySim-style
  data and are presented as such.

---

## Security notes and limitations

- All payments are simulated; no real banking credentials, cards or payment rails exist.
- Secrets belong in environment variables. `.env` files are Git-ignored; only examples are
  committed. The Compose default JWT secret is for local development only — replace it.
- Passwords are hashed with bcrypt (12 rounds). Tokens expire (`JWT_EXPIRES_IN=1d`).
- Rate limits: auth 50/15 min per IP, transfers 30/10 min per user, admin reviews 60/min per
  admin.
- Validation uses strict Zod schemas; registration cannot escalate to `admin`.
- Socket.IO rooms are per-user/admin; the handshake token is verified and the role reloaded.
- CORS/WebSocket origins come from `FRONTEND_URL`; configure it for your deployment.
- Known limitations: a single service instance is assumed for the in-process Redis fallback;
  the ML model is trained on synthetic data and is a demonstration, not a production model;
  there is no email/KYC/2FA, no refresh-token rotation, and no automated retraining.
- Do not deploy the demo credentials or the development JWT secret publicly.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Backend fails at startup with a transaction error | MongoDB is standalone | Use a replica set (`rs.initiate`) or Atlas; verify `replicaSet=rs0` |
| `/api/health` shows `redis: "degraded"` | Redis unreachable | Start Redis; the API still works with reduced guarantees |
| Payments always show `mlAvailable: false` | Fraud service down or model missing | Start FastAPI on port 8000; run training if artifacts are absent |
| Login works but the dashboard is empty | Seed not run / different database | Run `npm run seed`, check `MONGODB_URI` |
| Port already in use locally | Another Mongo/API/Redis is running | Stop it or change `PORT`, `MONGODB_URI`, `REDIS_URL` |
| Docker Compose cannot reach Docker | Daemon not running | Start Docker Desktop/Engine; this was the state during verification |
| Frontend API calls go to the wrong host | `VITE_API_URL` mismatch | Set it to `http://localhost:5000/api` in dev or `/api` behind nginx |
| Jest fails with “Instance failed to start within 10000ms” | Heavy parallel load | Run backend tests alone; retry |
| Password reset / email verification missing | Not implemented | Out of scope for this simulation |

---

## Further reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — beginner-friendly file-by-file walkthrough
  and end-to-end request trace.
- `backend/.env.example`, `frontend/.env.example`, `fraud-service/.env.example` — annotated
  configuration.
- FastAPI interactive docs: <http://localhost:8000/docs> while the fraud service runs.

---

**PayShield is a demonstration project. All financial activity is simulated.**
