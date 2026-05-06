import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Load user from stored token on mount
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch('/auth/me')
      .then(data => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setLoading(false);
      });
  }, [token]);

  const login = useCallback(async (email, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password, phone) => {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: { name, email, password, phone },
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const googleLogin = useCallback(async (credential) => {
    const data = await apiFetch('/auth/google', {
      method: 'POST',
      body: { credential },
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const restaurantRegister = useCallback(async (ownerData, restaurantData) => {
    const data = await apiFetch('/restaurant/register', {
      method: 'POST',
      body: { ...ownerData, ...restaurantData },
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, googleLogin, restaurantRegister, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
