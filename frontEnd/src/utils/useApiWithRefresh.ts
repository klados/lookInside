import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from './apiClient';

interface UseApiWithRefreshReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T>;
  reset: () => void;
}

export function useApiWithRefresh<T>(
  apiFunction: (...args: any[]) => Promise<T>,
  maxRetries: number = 1
): UseApiWithRefreshReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshToken } = useAuth();

  const execute = useCallback(
    async (...args: any[]): Promise<T> => {
      setLoading(true);
      setError(null);
      
      let lastError: any;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await apiFunction(...args);
          setData(result);
          setLoading(false);
          return result;
        } catch (error: any) {
          lastError = error;
          
          // If it's a 401 error and we haven't exceeded max retries, try to refresh token
          if (error.message?.includes('401') && attempt < maxRetries) {
            console.log(`Attempt ${attempt + 1}: Token expired, attempting refresh...`);
            try {
              const refreshed = await refreshToken();
              if (refreshed) {
                console.log('Token refreshed, retrying request...');
                continue; // Retry the request
              }
            } catch (refreshError) {
              console.error('Token refresh failed during retry:', refreshError);
              break; // Don't retry if refresh fails
            }
          }
          
          // If it's not a 401 error or we've exceeded retries, break
          break;
        }
      }
      
      // If we get here, all retries failed
      const errorMessage = lastError?.message || 'Request failed';
      setError(errorMessage);
      setLoading(false);
      throw lastError;
    },
    [apiFunction, maxRetries, refreshToken]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

// Convenience hook for common API operations
export function useApiGet<T>(endpoint: string, maxRetries: number = 1) {
  return useApiWithRefresh<T>(
    () => apiClient.get<T>(endpoint),
    maxRetries
  );
}

export function useApiPost<T>(endpoint: string, maxRetries: number = 1) {
  return useApiWithRefresh<T>(
    (data?: any) => apiClient.post<T>(endpoint, data),
    maxRetries
  );
}

export function useApiPut<T>(endpoint: string, maxRetries: number = 1) {
  return useApiWithRefresh<T>(
    (data?: any) => apiClient.put<T>(endpoint, data),
    maxRetries
  );
}

export function useApiDelete<T>(endpoint: string, maxRetries: number = 1) {
  return useApiWithRefresh<T>(
    () => apiClient.delete<T>(endpoint),
    maxRetries
  );
}
