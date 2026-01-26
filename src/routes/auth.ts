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

const checkAuthMethodSchema = Joi.object({
  employeeCode: Joi.string().required().trim(),
});

const loginPasswordSchema = Joi.object({
  employeeCode: Joi.string().required().trim(),
  password: Joi.string().required().min(1),
});

const setPasswordSchema = Joi.object({
  employeeCode: Joi.string().required().trim(),
  otp: Joi.string().required().length(6).pattern(/^\d+$/),
  password: Joi.string().required().min(8).max(128),
});

const adminLoginSchema = Joi.object({
  username: Joi.string().required().trim(),
  password: Joi.string().required(),
});

/**
 * POST /api/auth/employee/check-method
 * Check if employee has password set or needs OTP
 */
router.post(
  '/employee/check-method',
  validateRequest(checkAuthMethodSchema, 'body'),
  AuthController.checkAuthMethod
);

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
 * POST /api/auth/employee/login-password
 * Login with password (for existing users with password)
 */
router.post(
  '/employee/login-password',
  validateRequest(loginPasswordSchema, 'body'),
  AuthController.loginWithPassword
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
 * POST /api/auth/employee/set-password
 * Set password after OTP verification (for new users)
 */
router.post(
  '/employee/set-password',
  validateRequest(setPasswordSchema, 'body'),
  AuthController.setPassword
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

/**
 * POST /api/auth/admin/login
 * Admin login with username and password
 */
router.post(
  '/admin/login',
  validateRequest(adminLoginSchema, 'body'),
  AuthController.adminLogin
);

export default router;


