import { z } from 'zod';

const transactionStatuses = [
  'PENDING_REVIEW',
  'APPROVED',
  'COMPLETED',
  'DECLINED',
  'FAILED',
];

const riskLevels = ['LOW', 'MEDIUM', 'HIGH'];

export const transferSchema = z
  .object({
    receiverEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please provide the receiver email address.'),
    // Integer minor units (paise). The frontend converts rupees before sending.
    amount: z
      .number({ invalid_type_error: 'Amount must be a number in paise.' })
      .int('Amount must be an integer number of paise.')
      .positive('Amount must be greater than zero.')
      .max(100000000000, 'Amount exceeds the supported simulation limit.'),
    description: z.string().trim().max(140).optional().default(''),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
  })
  .strict();

export const transactionListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(transactionStatuses).optional(),
    riskLevel: z.enum(riskLevels).optional(),
    minAmount: z.coerce.number().int().min(0).optional(),
    maxAmount: z.coerce.number().int().min(0).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.minAmount === undefined ||
      data.maxAmount === undefined ||
      data.minAmount <= data.maxAmount,
    { message: 'minAmount cannot be greater than maxAmount.', path: ['minAmount'] }
  );

export const transactionIdParamSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
  })
  .strict();

export const ledgerQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const reviewActionSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, 'Please provide a review reason of at least 3 characters.')
      .max(500, 'Review reason must be at most 500 characters.'),
  })
  .strict();

export const fraudAlertQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['OPEN', 'RESOLVED']).optional(),
    riskLevel: z.enum(riskLevels).optional(),
  })
  .strict();
