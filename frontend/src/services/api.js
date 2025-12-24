import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

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

