import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = (import.meta.env?.VITE_API_URL as string) ?? '';

interface User {
  id: number;
  username: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'kukuys_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = (): Record<string, string> => {
    const t = token ?? localStorage.getItem(TOKEN_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  useEffect(() => {
    const t = token ?? localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          setToken(t);
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .catch(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem(TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'Login failed' };
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Network error' };
    }
  };

  const register = async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'Registration failed' };
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Network error' };
    }
  };

  const logout = () => {
    const t = token ?? localStorage.getItem(TOKEN_KEY);
    if (t) {
      fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
