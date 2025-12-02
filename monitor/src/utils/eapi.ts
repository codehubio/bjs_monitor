import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '../config';

/**
 * EAPI Client using Axios
 * Automatically includes SecurityToken header for all requests
 */
export class EapiClient {
  private client: AxiosInstance;

  constructor(baseUrl?: string, securityToken?: string) {
    const apiBaseUrl = baseUrl || config.eapiBaseUrl;
    const token = securityToken || config.eapiSecurityToken;

    if (!apiBaseUrl) {
      throw new Error('EAPI_BASE_URL must be set in environment variables or provided to constructor');
    }

    if (!token) {
      throw new Error('EAPI_SECURITY_TOKEN must be set in environment variables or provided to constructor');
    }

    // Create axios instance with base configuration
    this.client = axios.create({
      baseURL: apiBaseUrl,
      headers: {
        'SecurityToken': token,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds default timeout
    });

    // Add request interceptor for logging (optional)
    this.client.interceptors.request.use(
      (config) => {
        // Log request if needed (can be removed or made conditional)
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        // Enhanced error logging
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('EAPI Error Response:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            url: error.config?.url,
          });
        } else if (error.request) {
          // The request was made but no response was received
          console.error('EAPI Error: No response received', {
            url: error.config?.url,
          });
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('EAPI Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Make a GET request
   * @param url Endpoint URL (relative to base URL)
   * @param config Optional axios request config
   * @returns Promise with response data
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return response.data;
  }

  /**
   * Make a POST request
   * @param url Endpoint URL (relative to base URL)
   * @param data Request body data
   * @param config Optional axios request config
   * @returns Promise with response data
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * Make a PUT request
   * @param url Endpoint URL (relative to base URL)
   * @param data Request body data
   * @param config Optional axios request config
   * @returns Promise with response data
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  /**
   * Make a PATCH request
   * @param url Endpoint URL (relative to base URL)
   * @param data Request body data
   * @param config Optional axios request config
   * @returns Promise with response data
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.patch(url, data, config);
    return response.data;
  }

  /**
   * Make a DELETE request
   * @param url Endpoint URL (relative to base URL)
   * @param config Optional axios request config
   * @returns Promise with response data
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }

  /**
   * Get the underlying axios instance for advanced usage
   * @returns AxiosInstance
   */
  getClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Update the SecurityToken header
   * @param token New security token
   */
  setSecurityToken(token: string): void {
    this.client.defaults.headers.common['SecurityToken'] = token;
  }

  /**
   * Get the current base URL
   * @returns Base URL string
   */
  getBaseUrl(): string {
    return this.client.defaults.baseURL || '';
  }
}

/**
 * Create and export a default EAPI client instance
 * Uses environment variables from config
 */
export const eapiClient = new EapiClient();

/**
 * Create a new EAPI client instance with custom configuration
 * @param baseUrl Optional base URL (defaults to EAPI_BASE_URL from env)
 * @param securityToken Optional security token (defaults to EAPI_SECURITY_TOKEN from env)
 * @returns New EapiClient instance
 */
export function createEapiClient(baseUrl?: string, securityToken?: string): EapiClient {
  return new EapiClient(baseUrl, securityToken);
}

