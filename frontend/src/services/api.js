import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token expired or invalid
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUsername');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const chatsApi = {
  getAll: () => api.get('/chats'),
  create: (data) => api.post('/chats', data),
  delete: (id) => api.delete(`/chats/${id}`),
};

export const keywordsApi = {
  getAll: () => api.get('/keywords'),
  create: (data) => api.post('/keywords', data),
  delete: (id) => api.delete(`/keywords/${id}`),
};

export const alertsApi = {
  getAll: (params) => api.get('/alerts', { params }),
};

export default api;

