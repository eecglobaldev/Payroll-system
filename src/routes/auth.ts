/**
 * Authentication Routes
 * Employee OTP-based authentication endpoints
 * 
 * NOTE: These routes are PUBLIC (no API key required)
 */

import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { validateRequest } from '../utils/validation.js';
import Joi from 'joi';

const router = Router();

/**
 * Validation schemas
 */
const sendOTPSchema = Joi.object({
  employeeCode: Joi.string().required().trim(),
});

const verifyOTPSchema = Joi.object({
  employeeCode: Joi.string().required().trim(),
  otp: Joi.string().required().length(6).pattern(/^\d+$/),
});

const resendOTPSchema = Joi.object({
  employeeCode: Joi.string().required().trim(),
});

/**
 * POST /api/auth/employee/send-otp
 * Send OTP to employee's mobile number
 */
router.post(
  '/employee/send-otp',
  validateRequest(sendOTPSchema, 'body'),
  AuthController.sendOTP
);

/**
 * POST /api/auth/employee/verify-otp
 * Verify OTP and get JWT token
 */
router.post(
  '/employee/verify-otp',
  validateRequest(verifyOTPSchema, 'body'),
  AuthController.verifyOTP
);

/**
 * POST /api/auth/employee/resend-otp
 * Resend OTP to employee
 */
router.post(
  '/employee/resend-otp',
  validateRequest(resendOTPSchema, 'body'),
  AuthController.resendOTP
);

export default router;


