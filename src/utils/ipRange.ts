/**
 * IP Range Utilities
 * Helper functions for IP address validation and CIDR range checking
 */

/**
 * Convert IP address to numeric value
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Check if an IP address is within a CIDR range
 * @param ip - IP address to check (e.g., "192.168.10.50")
 * @param cidr - CIDR notation (e.g., "192.168.10.0/24")
 */
export function isInCIDR(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);
    
    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);
    
    return (ipNum & mask) === (rangeNum & mask);
  } catch (err) {
    const error = err as Error;
    console.error('[IP] CIDR check error:', error.message);
    return false;
  }
}

/**
 * Validate IPv4 address format
 */
export function isValidIPv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  
  return ip.split('.').every(octet => {
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
}

export { ipToNumber };

