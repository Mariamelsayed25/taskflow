import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });

// attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// unify errors; expired/invalid token sends the user back to login
api.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401 && !e.config.url.startsWith('/auth/login')) {
    localStorage.removeItem('token');
    if (location.pathname !== '/login') location.href = '/login';
  }
  e.message = e.response?.data?.message || 'Cannot reach the server';
  return Promise.reject(e);
});

export default api;
