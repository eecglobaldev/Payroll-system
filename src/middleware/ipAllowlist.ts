/**
 * IP Allowlist Middleware
 * Restricts API access to specific IP addresses or ranges
 */

import { Request, Response, NextFunction } from 'express';
import { isInCIDR } from '../utils/ipRange.js';

export function ipAllowlist(req: Request, res: Response, next: NextFunction): void {
  const allowlistConfig = process.env.IP_ALLOWLIST;
  
  // If no allowlist is configured, allow all requests
  if (!allowlistConfig || allowlistConfig.trim() === '') {
    next();
    return;
  }

  const allowedIPs = allowlistConfig.split(',').map(ip => ip.trim());
  const clientIP = req.ip || req.socket.remoteAddress || '';
  
  // Clean IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
  const cleanIP = clientIP.replace(/^::ffff:/, '');

  // Check if client IP is in allowlist
  const isAllowed = allowedIPs.some(allowedPattern => {
    if (allowedPattern.includes('/')) {
      // CIDR notation (e.g., 192.168.10.0/24)
      return isInCIDR(cleanIP, allowedPattern);
    } else {
      // Exact match
      return cleanIP === allowedPattern;
    }
  });

  if (!isAllowed) {
    console.warn(`[SECURITY] Blocked request from non-allowlisted IP: ${cleanIP}`);
    res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied from this IP address',
    });
    return;
  }

  next();
}

export default ipAllowlist;

