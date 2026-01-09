/**
 * MSG91 OTP Service
 * Integration with MSG91 for sending OTP via SMS
 */

interface MSG91Config {
  authKey: string;
  templateId?: string;
  senderId?: string;
}

interface SendOTPResponse {
  success: boolean;
  message: string;
  requestId?: string;
}

class MSG91Service {
  private readonly baseUrl = 'https://control.msg91.com/api/v5/otp';
  private config: MSG91Config;

  constructor() {
    this.config = {
      authKey: process.env.MSG91_AUTH_KEY || '',
      templateId: process.env.MSG91_TEMPLATE_ID || '',
      senderId: process.env.MSG91_SENDER_ID || 'MSGIND',
    };

    if (!this.config.authKey) {
      console.warn('[MSG91] MSG91_AUTH_KEY not configured. OTP sending will fail.');
    }
  }

  /**
   * Send OTP via MSG91
   */
  async sendOTP(mobile: string, otp: string): Promise<SendOTPResponse> {
    if (!this.config.authKey) {
      throw new Error('MSG91 authentication key not configured');
    }

    if (!mobile || !otp) {
      throw new Error('Mobile number and OTP are required');
    }

    // Clean mobile number (remove +, spaces, etc.)
    let cleanMobile = mobile.replace(/[+\s-]/g, '');
    
    // Add country code if not present (91 for India)
    // MSG91 requires country code in phone number format: 91XXXXXXXXXX
    if (cleanMobile.length === 10 && !cleanMobile.startsWith('91')) {
      cleanMobile = '91' + cleanMobile;
    } else if (cleanMobile.startsWith('0') && cleanMobile.length === 11) {
      // Remove leading 0 and add country code (e.g., 09307579506 → 919307579506)
      cleanMobile = '91' + cleanMobile.substring(1);
    }

    try {
      // MSG91 Send OTP API - Using POST method with proper format
      const senderId = this.config.senderId || 'MSGIND';
      
      // MSG91 OTP API requires template_id for template-based OTP
      // If template_id is provided, use template-based API
      // Otherwise, use message-based API
      
      let url: string;
      let requestBody: any;
      
      if (this.config.templateId) {
        // Template-based OTP (recommended) - Using POST method
        url = `${this.baseUrl}?authkey=${encodeURIComponent(this.config.authKey)}`;
        requestBody = {
          template_id: this.config.templateId,
          mobile: cleanMobile,
          otp: otp,
        };
      } else {
        // Message-based OTP (fallback) - Using GET method
        url = `${this.baseUrl}?authkey=${encodeURIComponent(this.config.authKey)}&mobile=${encodeURIComponent(cleanMobile)}&message=${encodeURIComponent(`Your OTP is ${otp}. Valid for 5 minutes.`)}&sender=${encodeURIComponent(senderId)}&otp=${encodeURIComponent(otp)}`;
        requestBody = null;
      }
      
      const fetchOptions: RequestInit = {
        method: requestBody ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (requestBody) {
        fetchOptions.body = JSON.stringify(requestBody);
      }

      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();

      let data: { type?: string; request_id?: string; message?: string; code?: string };
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid response from MSG91: ${responseText.substring(0, 100)}`);
      }

      // MSG91 success response can be type: 'success' or code-based
      const isSuccess = (response.ok && (data.type === 'success' || data.code === '200' || response.status === 200));
      
      if (isSuccess) {
        return {
          success: true,
          message: 'OTP sent successfully',
          requestId: data.request_id,
        };
      } else {
        throw new Error(data.message || `MSG91 API error: ${data.code || response.status}`);
      }
    } catch (error) {
      const err = error as Error;
      console.error('[MSG91] Error sending OTP:', err.message);
      throw new Error(`Failed to send OTP: ${err.message}`);
    }
  }

  /**
   * Resend OTP (if MSG91 supports retry)
   */
  async resendOTP(mobile: string): Promise<SendOTPResponse> {
    if (!this.config.authKey) {
      throw new Error('MSG91 authentication key not configured');
    }

    const cleanMobile = mobile.replace(/[+\s-]/g, '');

    try {
      const url = `${this.baseUrl}/retry?authkey=${encodeURIComponent(this.config.authKey)}&mobile=${encodeURIComponent(cleanMobile)}&retrytype=text`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json() as { type?: string; request_id?: string; message?: string };

      if (response.ok && data.type === 'success') {
        return {
          success: true,
          message: 'OTP resent successfully',
          requestId: data.request_id,
        };
      } else {
        throw new Error(data.message || 'Failed to resend OTP');
      }
    } catch (error) {
      const err = error as Error;
      console.error('[MSG91] Error resending OTP:', err);
      throw new Error(`Failed to resend OTP: ${err.message}`);
    }
  }

  /**
   * Verify OTP with MSG91 (optional - we verify in-memory)
   * This can be used as a backup verification method
   */
  async verifyOTP(mobile: string, otp: string): Promise<boolean> {
    if (!this.config.authKey) {
      return false;
    }

    const cleanMobile = mobile.replace(/[+\s-]/g, '');

    try {
      const url = `${this.baseUrl}/verify?authkey=${encodeURIComponent(this.config.authKey)}&mobile=${encodeURIComponent(cleanMobile)}&otp=${encodeURIComponent(otp)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json() as { type?: string };
      return response.ok && data.type === 'success';
    } catch (error) {
      console.error('[MSG91] Error verifying OTP:', error);
      return false;
    }
  }
}

// Singleton instance
export const msg91Service = new MSG91Service();

