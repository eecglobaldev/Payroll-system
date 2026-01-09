/**
 * Environment Configuration
 * Centralized configuration for API endpoints and environment variables
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

if (!import.meta.env.VITE_API_BASE_URL) {
  console.warn('VITE_API_BASE_URL not set. Using default: http://localhost:3000/api');
}

