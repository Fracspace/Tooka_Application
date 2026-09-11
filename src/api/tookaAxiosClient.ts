// tookaAxiosClient.ts

import axios from 'axios';

import { API_CONFIG } from '../config/api';

const tookaAxiosClient = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_CONFIG.apiKey,
  },
});

export default tookaAxiosClient;