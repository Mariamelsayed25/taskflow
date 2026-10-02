import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const Ctx = createContext();
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    if (!loading) return;
    api.get('/auth/me').then((r) => setUser(r.data.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const finish = ({ data }) => { localStorage.setItem('token', data.data.token); setUser(data.data.user); };
  const login = async (email, password) => finish(await api.post('/auth/login', { email, password }));
  const register = async (username, email, password) => finish(await api.post('/auth/register', { username, email, password }));
  const logout = () => { localStorage.removeItem('token'); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
