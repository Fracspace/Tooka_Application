import axios from 'axios';
import { DeviceEventEmitter } from 'react-native';

import { API_CONFIG } from '../config/api';
import { getAuthToken } from '../utils/authStorage';

const authAxiosClient = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-api-key': API_CONFIG.apiKey,
  },
});

authAxiosClient.interceptors.request.use(
  async config => {
    try {
      const token = await getAuthToken();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Automatically set multipart header for FormData
      if (config.data instanceof FormData) {
        config.headers['Content-Type'] = 'multipart/form-data';
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(
          '[authAxiosClient] Failed to fetch token from storage',
          error,
        );
      }
    }

    return config;
  },
  error => Promise.reject(error),
);

authAxiosClient.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401) {
      // Pass the token this request was sent with, so a late 401 from before a
      // re-login cannot log the new session out.
      const authHeader = String(error?.config?.headers?.Authorization ?? '');
      DeviceEventEmitter.emit('UNAUTHORIZED', {
        token: authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null,
      });
    }

    if (__DEV__) {
      console.log(
        '[authAxiosClient] API error =>',
        error?.response?.data || error,
      );
    }

    return Promise.reject(error);
  },
);

export default authAxiosClient;