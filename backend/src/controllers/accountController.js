import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAccountForUser } from '../services/accountService.js';
import { listLedgerEntries } from '../services/ledgerService.js';

export const me = asyncHandler(async (req, res) => {
  const account = await getAccountForUser(req.user._id);

  return sendSuccess(res, {
    account: account.toJSON(),
    user: req.user.toSafeJSON(),
  });
});

export const ledger = asyncHandler(async (req, res) => {
  const account = await getAccountForUser(req.user._id);
  const result = await listLedgerEntries(account._id, req.query);
  return sendSuccess(res, result);
});
