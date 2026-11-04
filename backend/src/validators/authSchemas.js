import { z } from 'zod';

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please provide a valid email address.');

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
  .regex(/\d/, 'Password must contain at least one number.');

// .strict() rejects extra fields, including any attempted role escalation.
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
    email: emailField,
    password: passwordField,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailField,
    password: z.string().min(1, 'Password is required.'),
  })
  .strict();
