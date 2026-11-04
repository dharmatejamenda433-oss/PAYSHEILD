import { randomUUID } from 'node:crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { createTransfer } from '../services/paymentService.js';
import {
  listTransactions,
  getTransaction,
  getTransactionRisk,
} from '../services/transactionService.js';
import { presentTransaction } from '../services/transactionPresenter.js';

function readHeader(req, name, maxLength = 120) {
  const value = req.get(name);
  if (!value) return null;
  return value.trim().slice(0, maxLength);
}

export const create = asyncHandler(async (req, res) => {
  const headerKey = req.get('Idempotency-Key');
  const bodyKey = req.body.idempotencyKey;
  const idempotencyKey = (headerKey || bodyKey || randomUUID()).trim();

  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    throw ApiError.badRequest(
      'Idempotency-Key must be between 8 and 120 characters.'
    );
  }

  const result = await createTransfer({
    sender: req.user,
    input: { ...req.body, idempotencyKey },
    meta: {
      deviceId: readHeader(req, 'X-Device-Id'),
      location: readHeader(req, 'X-Client-Location'),
    },
  });

  res.set('Idempotency-Replayed', String(result.replay));

  return sendSuccess(
    res,
    {
      transaction: presentTransaction(result.transaction, req.user._id),
      replay: result.replay,
    },
    result.replay ? 200 : 201
  );
});

export const listMine = asyncHandler(async (req, res) => {
  const result = await listTransactions({
    userId: req.user._id,
    applyOwnership: true,
    filters: req.query,
  });

  return sendSuccess(res, result);
});

export const detail = asyncHandler(async (req, res) => {
  const transaction = await getTransaction(req.params.id, req.user);
  return sendSuccess(res, { transaction });
});

export const risk = asyncHandler(async (req, res) => {
  const result = await getTransactionRisk(req.params.id, req.user);
  return sendSuccess(res, result);
});
