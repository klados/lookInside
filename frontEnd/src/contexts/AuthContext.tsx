import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import apiClient from '../utils/apiClient';

interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: string;
  is_blocked: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: User) => void
  logout: () => void;
  checkAuthStatus: () => Promise<boolean>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Add refs to prevent multiple simultaneous auth checks
  const authCheckInProgress = useRef<boolean>(false);
  const lastAuthCheck = useRef<number>(0);
  const authCheckInterval = 5 * 60 * 1000; // 5 minutes between checks

  // Check authentication status on mount only once
  useEffect(() => {
    const initializeAuth = async () => {
      if (!authCheckInProgress.current) {
        await checkAuthStatus();
      }
    };
    
    initializeAuth();
  }, []); // Empty dependency array - only run on mount

  const checkAuthStatus = async (): Promise<boolean> => {
    // Prevent multiple simultaneous auth checks
    if (authCheckInProgress.current) {
      console.log('Auth check already in progress, skipping...');
      return isAuthenticated;
    }

    // Check if we've recently validated the token
    const now = Date.now();
    if (now - lastAuthCheck.current < authCheckInterval && isAuthenticated) {
      console.log('Token recently validated, skipping check...');
      return isAuthenticated;
    }

    console.log('Starting authentication check...');
    
    try {
      authCheckInProgress.current = true;
      setIsLoading(true);
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
      lastAuthCheck.current = now;
      return true;
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setIsAuthenticated(false);
      setUser(null);
      lastAuthCheck.current = now;
      return false;
    } finally {
      authCheckInProgress.current = false;
      setIsLoading(false);
      console.log('Authentication check completed');
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      console.log('Attempting to refresh token from AuthContext...');
      const success = await apiClient.refreshToken();
      
      if (success) {
        // After successful token refresh, update the user data
        try {
          const userData = await apiClient.getCurrentUser();
          setUser(userData);
          setIsAuthenticated(true);
          lastAuthCheck.current = Date.now();
          console.log('Token refreshed and user data updated successfully');
          return true;
        } catch (userError) {
          console.error('Failed to get user data after token refresh:', userError);
          // Even if getting user data fails, the token was refreshed
          return true;
        }
      } else {
        console.error('Token refresh failed');
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  };

  const login = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    lastAuthCheck.current = Date.now();
  };

  const logout = async () => {
    try {
      // Call logout endpoint to clear cookies
      await apiClient.logout();
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Clear local state regardless of request success
      setUser(null);
      setIsAuthenticated(false);
      lastAuthCheck.current = 0;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuthStatus,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
