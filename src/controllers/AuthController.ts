/**
 * Authentication Controller
 * Employee OTP-based authentication
 */

import { Request, Response } from 'express';
import { EmployeeModel } from '../models/EmployeeModel.js';
import { EmployeeDetailsModel } from '../models/EmployeeDetailsModel.js';
import { otpService } from '../services/otpService.js';
import { msg91Service } from '../services/msg91Service.js';
import { generateToken } from '../utils/jwt.js';

export class AuthController {
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

      // Check if phone number exists
      if (!employeeDetails.PhoneNumber) {
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
      const { employeeCode, otp } = req.body;

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

      // Verify OTP
      const verification = otpService.verifyOTP(employeeCode, otp);

      if (!verification.valid) {
        res.status(400).json({
          success: false,
          error: verification.message,
        });
        return;
      }

      // OTP is valid - get employee details
      const employee = await EmployeeModel.getByCode(employeeCode);
      if (!employee) {
        res.status(404).json({
          success: false,
          error: 'Employee not found',
        });
        return;
      }

      // Generate JWT token
      const token = generateToken({
        employeeCode: employee.EmployeeCode,
        role: 'EMPLOYEE',
        userId: employee.EmployeeId,
      });

      // Return token and employee info
      res.json({
        success: true,
        data: {
          token,
          employeeCode: employee.EmployeeCode,
          role: 'EMPLOYEE',
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
}


