/**
 * Authentication Context
 * Manages employee authentication state and JWT token
 * OTP-based authentication
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { verifyOTP, getEmployeeProfile } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  employeeCode: string | null;
  role: string | null;
  verifyOTPAndLogin: (employeeCode: string, otp: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [employeeCode, setEmployeeCode] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedEmployeeCode = localStorage.getItem('employeeCode');
      const storedRole = localStorage.getItem('role');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedEmployeeCode) {
        setToken(storedToken);
        setEmployeeCode(storedEmployeeCode);
        setRole(storedRole);
        
        // Try to load user profile
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (e) {
            console.error('Failed to parse stored user:', e);
          }
        }
        
        // Verify token by fetching profile
        try {
          const profile = await getEmployeeProfile();
          setUser(profile);
          localStorage.setItem('user', JSON.stringify(profile));
        } catch (error) {
          // Token invalid, clear storage
          console.error('Token validation failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('employeeCode');
          localStorage.removeItem('role');
          localStorage.removeItem('user');
          setToken(null);
          setEmployeeCode(null);
          setRole(null);
          setUser(null);
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const verifyOTPAndLogin = async (employeeCode: string, otp: string): Promise<boolean> => {
    try {
      const response = await verifyOTP(employeeCode, otp);
      
      // Store token and user info
      localStorage.setItem('token', response.token);
      localStorage.setItem('employeeCode', response.employeeCode);
      localStorage.setItem('role', response.role);
      
      setToken(response.token);
      setEmployeeCode(response.employeeCode);
      setRole(response.role);
      
      // Fetch user profile
      try {
        const profile = await getEmployeeProfile();
        setUser(profile);
        localStorage.setItem('user', JSON.stringify(profile));
      } catch (error) {
        console.error('[AuthContext] Failed to fetch user profile:', error);
        // Still allow login if profile fetch fails
      }
      
      return true;
    } catch (error) {
      console.error('[AuthContext] OTP verification failed:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('employeeCode');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    
    setToken(null);
    setEmployeeCode(null);
    setRole(null);
    setUser(null);
    
    // Redirect to login - will be handled by ProtectedRoute
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isAuthenticated: !!token, 
        token,
        employeeCode,
        role,
        verifyOTPAndLogin, 
        logout, 
        isLoading 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
