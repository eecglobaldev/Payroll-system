/**
 * Authentication Controller
 * Employee OTP-based authentication
 */

import { Request, Response } from 'express';
import { EmployeeModel } from '../models/EmployeeModel.js';
import { EmployeeDetailsModel } from '../models/EmployeeDetailsModel.js';
import { AdminUserModel } from '../models/AdminUserModel.js';
import { EmployeePasswordModel } from '../models/EmployeePasswordModel.js';
import { otpService } from '../services/otpService.js';
import { msg91Service } from '../services/msg91Service.js';
import { generateToken } from '../utils/jwt.js';
import { validatePasswordStrength } from '../utils/password.js';

export class AuthController {
  /**
   * POST /api/auth/employee/check-method
   * Check if employee has password set or needs OTP
   */
  static async checkAuthMethod(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.body;

      if (!employeeCode || typeof employeeCode !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Employee code is required',
        });
        return;
      }

      // Validate employee exists and is active
      const employee = await EmployeeModel.getByCode(employeeCode);
      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
        });
        return;
      }

      // Get employee details to check if active
      const employeeDetails = await EmployeeDetailsModel.getByCode(employeeCode);
      if (!employeeDetails) {
        res.status(404).json({
          success: false,
          error: 'Employee details not found',
        });
        return;
      }

      // Check if employee is active (no exit date)
      if (employeeDetails.ExitDate) {
        res.status(403).json({
          success: false,
          error: 'Employee account is inactive',
        });
        return;
      }

      // Check if password exists
      const hasPassword = await EmployeePasswordModel.hasPassword(employeeCode);

      // Check if account is locked
      const lockoutInfo = await EmployeePasswordModel.getLockoutInfo(employeeCode);

      res.json({
        success: true,
        data: {
          hasPassword,
          requiresOTP: !hasPassword,
          isLocked: lockoutInfo.isLocked,
          lockedUntil: lockoutInfo.lockedUntil,
          attemptsRemaining: lockoutInfo.attemptsRemaining,
          message: hasPassword
            ? 'Password login available'
            : 'OTP required for first-time setup',
        },
      });
    } catch (error) {
      const err = error as Error;
      console.error('[AuthController] Error in checkAuthMethod:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/auth/employee/login-password
   * Login with password (for existing users)
   */
  static async loginWithPassword(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, password } = req.body;

      if (!employeeCode || typeof employeeCode !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Employee code is required',
        });
        return;
      }

      if (!password || typeof password !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Password is required',
        });
        return;
      }

      // Validate employee exists
      const employee = await EmployeeModel.getByCode(employeeCode);
      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
        });
        return;
      }

      // Check if account is locked
      const isLocked = await EmployeePasswordModel.isAccountLocked(employeeCode);
      if (isLocked) {
        const lockoutInfo = await EmployeePasswordModel.getLockoutInfo(employeeCode);
        res.status(403).json({
          success: false,
          error: 'Account is locked due to multiple failed login attempts',
          lockedUntil: lockoutInfo.lockedUntil,
          message: `Account locked. Please try again after ${lockoutInfo.lockedUntil ? new Date(lockoutInfo.lockedUntil).toLocaleString() : 'lockout period expires'}.`,
        });
        return;
      }

      // Verify password
      const isValid = await EmployeePasswordModel.verifyPassword(employeeCode, password);

      if (!isValid) {
        // Get updated lockout info after failed attempt
        const lockoutInfo = await EmployeePasswordModel.getLockoutInfo(employeeCode);
        
        // Check if account was just locked
        if (lockoutInfo.isLocked) {
          res.status(403).json({
            success: false,
            error: 'Invalid password. Account locked due to multiple failed attempts.',
            lockedUntil: lockoutInfo.lockedUntil,
            attemptsRemaining: 0,
          });
          return;
        }

        res.status(401).json({
          success: false,
          error: 'Invalid password',
          attemptsRemaining: lockoutInfo.attemptsRemaining,
          message: `Invalid password. ${lockoutInfo.attemptsRemaining} attempt(s) remaining.`,
        });
        return;
      }

      // Password is valid - generate JWT token
      const tokenEmployeeCode = employee.EmployeeCode;
      const tokenEmployeeId = employee.EmployeeId;

      if (!tokenEmployeeCode) {
        console.error('[AuthController] EmployeeCode is missing from employee object:', employee);
        res.status(500).json({
          success: false,
          error: 'Internal server error - Employee code not found',
        });
        return;
      }

      const tokenPayload = {
        employeeCode: tokenEmployeeCode,
        role: 'EMPLOYEE',
        userId: tokenEmployeeId,
      };

      const token = generateToken(tokenPayload);

      console.log('[AuthController] Password login successful for employee:', tokenEmployeeCode);

      // Return token and employee info
      res.json({
        success: true,
        data: {
          token,
          employeeCode: tokenEmployeeCode,
          role: 'EMPLOYEE',
        },
        message: 'Login successful',
      });
    } catch (error) {
      const err = error as Error;
      console.error('[AuthController] Error in loginWithPassword:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/auth/employee/set-password
   * Set password after OTP verification (for new users)
   */
  static async setPassword(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode, otp, password } = req.body;

      if (!employeeCode || typeof employeeCode !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Employee code is required',
        });
        return;
      }

      if (!otp || typeof otp !== 'string') {
        res.status(400).json({
          success: false,
          error: 'OTP is required',
        });
        return;
      }

      if (!password || typeof password !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Password is required',
        });
        return;
      }

      // Verify OTP first
      const verification = otpService.verifyOTP(employeeCode, otp);

      if (!verification.valid) {
        res.status(400).json({
          success: false,
          error: verification.message,
        });
        return;
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        res.status(400).json({
          success: false,
          error: 'Password does not meet requirements',
          errors: passwordValidation.errors,
        });
        return;
      }

      // Validate employee exists
      const employee = await EmployeeModel.getByCode(employeeCode);
      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
        });
        return;
      }

      // Create password
      await EmployeePasswordModel.createPassword(employeeCode, password);

      // Generate JWT token
      const tokenEmployeeCode = employee.EmployeeCode;
      const tokenEmployeeId = employee.EmployeeId;

      if (!tokenEmployeeCode) {
        console.error('[AuthController] EmployeeCode is missing from employee object:', employee);
        res.status(500).json({
          success: false,
          error: 'Internal server error - Employee code not found',
        });
        return;
      }

      const tokenPayload = {
        employeeCode: tokenEmployeeCode,
        role: 'EMPLOYEE',
        userId: tokenEmployeeId,
      };

      const token = generateToken(tokenPayload);

      console.log('[AuthController] Password set successfully for employee:', tokenEmployeeCode);

      // Return token and employee info
      res.json({
        success: true,
        data: {
          token,
          employeeCode: tokenEmployeeCode,
          role: 'EMPLOYEE',
        },
        message: 'Password set successfully. You are now logged in.',
      });
    } catch (error) {
      const err = error as Error;
      console.error('[AuthController] Error in setPassword:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/auth/employee/send-otp
   * Send OTP to employee's registered mobile number
   */
  static async sendOTP(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.body;

      if (!employeeCode || typeof employeeCode !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Employee code is required',
        });
        return;
      }

      // Validate employee exists and is active
      const employee = await EmployeeModel.getByCode(employeeCode);
      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
        });
        return;
      }

      // Get employee details for phone number
      const employeeDetails = await EmployeeDetailsModel.getByCode(employeeCode);
      
      console.log(`[AuthController] Employee details for ${employeeCode}:`, {
        phoneNumber: employeeDetails?.PhoneNumber,
        department: employeeDetails?.Department,
        designation: employeeDetails?.Designation,
      });
      
      if (!employeeDetails) {
        res.status(404).json({
          success: false,
          error: 'Employee details not found',
        });
        return;
      }

      // Check if employee is active (no exit date)
      if (employeeDetails.ExitDate) {
        res.status(403).json({
          success: false,
          error: 'Employee account is inactive',
        });
        return;
      }

      // Check if phone number exists (handle empty strings and whitespace)
      if (!employeeDetails.PhoneNumber || employeeDetails.PhoneNumber.trim() === '') {
        console.error(`[AuthController] Phone number check failed for ${employeeCode}:`, {
          phoneNumber: employeeDetails.PhoneNumber,
          isNull: employeeDetails.PhoneNumber === null,
          isUndefined: employeeDetails.PhoneNumber === undefined,
          isEmpty: employeeDetails.PhoneNumber === '',
          trimmedEmpty: employeeDetails.PhoneNumber?.trim() === '',
        });
        res.status(400).json({
          success: false,
          error: 'Phone number not registered. Please contact HR.',
        });
        return;
      }

      // Generate OTP
      const otp = otpService.generateOTP();

      // Store OTP in memory
      otpService.storeOTP(employeeCode, otp);

      // Send OTP via MSG91
      try {
        await msg91Service.sendOTP(employeeDetails.PhoneNumber, otp);
        
        // In development mode, also return OTP for testing
        const isDevMode = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_OTP === 'true';
        
        if (isDevMode) {
          res.json({
            success: true,
            message: 'OTP sent successfully to your registered mobile number',
            devOTP: otp, // Only in development
            phoneNumber: employeeDetails.PhoneNumber, // Only in development
            warning: 'Development mode - OTP exposed for testing only',
          });
        } else {
          res.json({
            success: true,
            message: 'OTP sent successfully to your registered mobile number',
          });
        }
      } catch (smsError) {
        const err = smsError as Error;
        console.error('[AuthController] Failed to send OTP:', err.message);
        
        // In development, return OTP for testing
        if (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_OTP === 'true') {
          res.json({
            success: true,
            message: 'OTP sent successfully (DEV MODE)',
            devOTP: otp,
            phoneNumber: employeeDetails.PhoneNumber,
            warning: 'This is development mode - OTP exposed for testing',
          });
          return;
        }
        
        res.status(500).json({
          success: false,
          error: 'Failed to send OTP. Please try again later.',
          details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
      }
    } catch (error) {
      const err = error as Error;
      console.error('[AuthController] Error in sendOTP:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/auth/employee/verify-otp
   * Verify OTP and issue JWT token
   */
  static async verifyOTP(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode: inputEmployeeCode, otp } = req.body;

      if (!inputEmployeeCode || typeof inputEmployeeCode !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Employee code is required',
        });
        return;
      }

      if (!otp || typeof otp !== 'string') {
        res.status(400).json({
          success: false,
          error: 'OTP is required',
        });
        return;
      }

      // Check if user has password set first
      const hasPassword = await EmployeePasswordModel.hasPassword(inputEmployeeCode);

      // Verify OTP - if password setup is required, don't consume the OTP yet
      // It will be consumed when setting the password
      const verification = hasPassword 
        ? otpService.verifyOTP(inputEmployeeCode, otp) // Consume OTP for users with password
        : otpService.verifyOTPWithoutConsuming(inputEmployeeCode, otp); // Don't consume for password setup

      if (!verification.valid) {
        res.status(400).json({
          success: false,
          error: verification.message,
        });
        return;
      }

      // OTP is valid - get employee details
      const employee = await EmployeeModel.getByCode(inputEmployeeCode);
      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
        });
        return;
      }

      if (!hasPassword) {
        // User doesn't have password - return flag to indicate password setup required
        // OTP is still valid and will be consumed in setPassword endpoint
        res.json({
          success: true,
          data: {
            requiresPasswordSetup: true,
            employeeCode: inputEmployeeCode,
            message: 'OTP verified. Please set your password.',
          },
        });
        return;
      }

      // User has password - generate JWT token and log them in
      // Employee model now returns PascalCase properties via mapToEmployee
      const tokenEmployeeCode = employee.EmployeeCode;
      const tokenEmployeeId = employee.EmployeeId;
      
      if (!tokenEmployeeCode) {
        console.error('[AuthController] EmployeeCode is missing from employee object:', employee);
        res.status(500).json({
          success: false,
          error: 'Internal server error - Employee code not found',
        });
        return;
      }
      
      console.log('[AuthController] Generating token for employee:', {
        EmployeeCode: tokenEmployeeCode,
        EmployeeId: tokenEmployeeId,
        EmployeeName: employee.EmployeeName,
        RawEmployee: employee,
      });
      
      const tokenPayload = {
        employeeCode: tokenEmployeeCode,
        role: 'EMPLOYEE',
        userId: tokenEmployeeId,
      };
      
      console.log('[AuthController] Token payload:', tokenPayload);
      
      const token = generateToken(tokenPayload);
      
      console.log('[AuthController] Token generated, length:', token.length);

      // Return token and employee info
      res.json({
        success: true,
        data: {
          token,
          employeeCode: tokenEmployeeCode,
          role: 'EMPLOYEE',
          requiresPasswordSetup: false,
        },
        message: 'OTP verified successfully',
      });
    } catch (error) {
      const err = error as Error;
      console.error('[AuthController] Error in verifyOTP:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/auth/employee/resend-otp
   * Resend OTP to employee
   */
  static async resendOTP(req: Request, res: Response): Promise<void> {
    try {
      const { employeeCode } = req.body;

      if (!employeeCode || typeof employeeCode !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Employee code is required',
        });
        return;
      }

      // Validate employee exists
      const employee = await EmployeeModel.getByCode(employeeCode);
      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
        });
        return;
      }

      // Get employee details for phone number
      const employeeDetails = await EmployeeDetailsModel.getByCode(employeeCode);
      if (!employeeDetails || !employeeDetails.PhoneNumber) {
        res.status(400).json({
          success: false,
          error: 'Phone number not registered',
        });
        return;
      }

      // Generate new OTP
      const otp = otpService.generateOTP();
      otpService.storeOTP(employeeCode, otp);

      // Resend via MSG91
      try {
        await msg91Service.resendOTP(employeeDetails.PhoneNumber);
        
        res.json({
          success: true,
          message: 'OTP resent successfully',
        });
      } catch (smsError) {
        console.error('[AuthController] Failed to resend OTP:', smsError);
        res.status(500).json({
          success: false,
          error: 'Failed to resend OTP. Please try again later.',
        });
      }
    } catch (error) {
      const err = error as Error;
      console.error('[AuthController] Error in resendOTP:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }

  /**
   * POST /api/auth/admin/login
   * Admin login with username and password
   */
  static async adminLogin(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      if (!username || typeof username !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Username is required',
        });
        return;
      }

      if (!password || typeof password !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Password is required',
        });
        return;
      }

      // Verify admin credentials
      const admin = await AdminUserModel.verifyCredentials(username, password);

      if (!admin) {
        res.status(401).json({
          success: false,
          error: 'Invalid username or password',
        });
        return;
      }

      // Generate JWT token
      const token = generateToken({
        employeeCode: admin.username, // Use username as employeeCode for consistency
        role: 'ADMIN',
        userId: admin.id,
      });

      // Return token and admin info
      res.json({
        success: true,
        data: {
          token,
          username: admin.username,
          role: 'ADMIN',
        },
        message: 'Login successful',
      });
    } catch (error) {
      const err = error as Error;
      console.error('[AuthController] Error in adminLogin:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message,
      });
    }
  }
}


