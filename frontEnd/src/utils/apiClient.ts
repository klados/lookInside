import { API_BASE } from '../config';

class ApiClient {
  private baseURL: string;
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private lastValidationTime: number = 0;
  private readonly validationCooldown = 1000; // 1 second cooldown between validation requests
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    config: RequestInit;
    url: string;
  }> = [];

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private processQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach(({ resolve, reject, config, url }) => {
      if (error) {
        reject(error);
      } else {
        resolve(this.requestWithConfig(url, config));
      }
    });
    this.failedQueue = [];
  }

  private async requestWithConfig(url: string, config: RequestInit): Promise<any> {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      credentials: 'include', // Always include cookies in requests
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      // If unauthorized, try to refresh the token
      if (response.status === 401) {
        // Don't try to refresh if this is already a refresh request
        if (endpoint === '/api/v1/auth/refresh') {
          // Only redirect if not already on the home page to prevent loops
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
          throw new Error('Unauthorized - please log in again');
        }

        // Try to refresh the token
        try {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Retry the original request with the new token
            const retryResponse = await fetch(url, config);
            if (!retryResponse.ok) {
              throw new Error(`HTTP error! status: ${retryResponse.status}`);
            }
            return await retryResponse.json();
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Only redirect if not already on the home page to prevent loops
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
          throw new Error('Unauthorized - please log in again');
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Generic methods
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', credentials: 'include'});
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Auth-specific methods
  async googleCallback(code: string): Promise<any> {
    return this.post('/api/v1/auth/google/callback', { code });
  }

  async validateToken(): Promise<any> {
    const now = Date.now();
    
    // Rate limiting for validation requests
    if (now - this.lastValidationTime < this.validationCooldown) {
      console.warn('Token validation called too frequently, skipping request');
      return { valid: false, error: 'Rate limited' };
    }
    
    // Check if there's already a pending validation request
    const requestKey = 'validateToken';
    if (this.pendingRequests.has(requestKey)) {
      console.log('Validation request already pending, reusing...');
      return this.pendingRequests.get(requestKey);
    }
    
    console.log('Making new token validation request...');
    
    // Create new validation request
    const validationPromise = this.get('/api/v1/auth/validateToken');
    this.pendingRequests.set(requestKey, validationPromise);
    
    try {
      this.lastValidationTime = now;
      const result = await validationPromise;
      console.log('Token validation request completed');
      return result;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  async logout(): Promise<any> {
    return this.post('/api/v1/auth/logout');
  }

  async refreshToken(): Promise<boolean> {
    if (this.isRefreshing) {
      // If already refreshing, wait for it to complete
      return new Promise((resolve, reject) => {
        this.failedQueue.push({
          resolve,
          reject,
          config: {},
          url: ''
        });
      });
    }

    this.isRefreshing = true;

    try {
      console.log('Attempting to refresh token...');
      const response = await fetch(`${this.baseURL}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('Token refreshed successfully');
        this.processQueue(null, 'refreshed');
        return true;
      } else {
        console.error('Token refresh failed with status:', response.status);
        this.processQueue(new Error('Token refresh failed'));
        return false;
      }
    } catch (error) {
      console.error('Token refresh request failed:', error);
      this.processQueue(error);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  async getCurrentUser(): Promise<any> {
    return this.get('/api/v1/auth/me');
  }

  // Create a request interceptor for automatic token refresh
  createRequestInterceptor() {
    return async <T>(
      requestFn: () => Promise<T>,
      maxRetries: number = 1
    ): Promise<T> => {
      let lastError: any;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await requestFn();
        } catch (error: any) {
          lastError = error;
          
          // If it's a 401 error and we haven't exceeded max retries, try to refresh token
          if (error.message?.includes('401') && attempt < maxRetries) {
            console.log(`Attempt ${attempt + 1}: Token expired, attempting refresh...`);
            try {
              const refreshed = await this.refreshToken();
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
      
      throw lastError;
    };
  }
}

export const apiClient = new ApiClient(API_BASE);
export default apiClient;
