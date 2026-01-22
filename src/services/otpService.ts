/**
 * OTP Service
 * In-memory OTP storage and management
 * NO DATABASE - All OTPs stored in memory
 */

interface OTPData {
  otp: string;
  expiresAt: number; // Unix timestamp in milliseconds
  attempts: number;
  employeeCode: string;
}

class OTPService {
  private otpStore: Map<string, OTPData> = new Map();
  private readonly OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ATTEMPTS = 3;
  private readonly OTP_LENGTH = 6;

  /**
   * Generate 6-digit numeric OTP
   */
  generateOTP(): string {
    const min = Math.pow(10, this.OTP_LENGTH - 1);
    const max = Math.pow(10, this.OTP_LENGTH) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Store OTP for employee
   */
  storeOTP(employeeCode: string, otp: string): void {
    const expiresAt = Date.now() + this.OTP_EXPIRY_MS;
    
    this.otpStore.set(employeeCode, {
      otp,
      expiresAt,
      attempts: 0,
      employeeCode,
    });

    // Auto-cleanup expired OTPs
    this.cleanupExpiredOTPs();
  }

  /**
   * Verify OTP
   * Returns: { valid: boolean, message: string }
   */
  verifyOTP(employeeCode: string, otp: string): { valid: boolean; message: string } {
    const otpData = this.otpStore.get(employeeCode);

    if (!otpData) {
      return {
        valid: false,
        message: 'OTP not found. Please request a new OTP.',
      };
    }

    // Check expiry
    if (Date.now() > otpData.expiresAt) {
      this.otpStore.delete(employeeCode);
      return {
        valid: false,
        message: 'OTP has expired. Please request a new OTP.',
      };
    }

    // Check attempts
    if (otpData.attempts >= this.MAX_ATTEMPTS) {
      this.otpStore.delete(employeeCode);
      return {
        valid: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.',
      };
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      otpData.attempts++;
      return {
        valid: false,
        message: `Invalid OTP. ${this.MAX_ATTEMPTS - otpData.attempts} attempts remaining.`,
      };
    }

    // OTP is valid - delete it
    this.otpStore.delete(employeeCode);
    return {
      valid: true,
      message: 'OTP verified successfully.',
    };
  }

  /**
   * Check if OTP exists for employee
   */
  hasOTP(employeeCode: string): boolean {
    const otpData = this.otpStore.get(employeeCode);
    if (!otpData) return false;
    
    // Check if expired
    if (Date.now() > otpData.expiresAt) {
      this.otpStore.delete(employeeCode);
      return false;
    }
    
    return true;
  }

  /**
   * Delete OTP (after successful verification or manual cleanup)
   */
  deleteOTP(employeeCode: string): void {
    this.otpStore.delete(employeeCode);
  }

  /**
   * Cleanup expired OTPs
   */
  private cleanupExpiredOTPs(): void {
    const now = Date.now();
    for (const [employeeCode, otpData] of this.otpStore.entries()) {
      if (now > otpData.expiresAt) {
        this.otpStore.delete(employeeCode);
      }
    }
  }

  /**
   * Get OTP expiry time (for testing/debugging only)
   * DO NOT expose OTP value
   */
  getOTPInfo(employeeCode: string): { exists: boolean; expiresAt?: number; attempts?: number } {
    const otpData = this.otpStore.get(employeeCode);
    if (!otpData) {
      return { exists: false };
    }
    
    return {
      exists: true,
      expiresAt: otpData.expiresAt,
      attempts: otpData.attempts,
    };
  }
}

// Singleton instance
export const otpService = new OTPService();


