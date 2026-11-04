import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { registerCustomer, login, getProfile } from '../services/authService.js';

export const register = asyncHandler(async (req, res) => {
  const result = await registerCustomer(req.body);
  return sendSuccess(res, result, 201);
});

export const loginUser = asyncHandler(async (req, res) => {
  const result = await login(req.body);
  return sendSuccess(res, result);
});

export const profile = asyncHandler(async (req, res) => {
  const result = await getProfile(req.user._id);
  return sendSuccess(res, result);
});
