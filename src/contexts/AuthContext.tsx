import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const WARN_BEFORE_MS = 5 * 60 * 1000;
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  avatar: string | null;
  isActive: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  updateCurrentUser: (updates: Partial<User>) => void;
  sessionWarning: boolean;
  extendSession: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try { const s = localStorage.getItem('pf_currentUser'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [sessionWarning, setSessionWarning] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (currentUser) localStorage.setItem('pf_currentUser', JSON.stringify(currentUser));
    else localStorage.removeItem('pf_currentUser');
  }, [currentUser]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setSessionWarning(false);
    localStorage.removeItem('pf_accessToken');
    localStorage.removeItem('pf_refreshToken');
    localStorage.removeItem('pf_currentUser');
  }, []);

  const extendSession = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSessionWarning(false);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      return;
    }
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      if (sessionWarning) setSessionWarning(false);
    };
    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('click', resetActivity);
    sessionTimerRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= SESSION_TIMEOUT_MS) logout();
      else if (idle >= SESSION_TIMEOUT_MS - WARN_BEFORE_MS) setSessionWarning(true);
    }, 30_000);
    return () => {
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('click', resetActivity);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [currentUser, sessionWarning, logout]);

  const login = useCallback(async (
    username: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { ok: false, error: data.message ?? 'Invalid username or password' };
      }
      const { tokens, user } = data.data;
      localStorage.setItem('pf_accessToken', tokens.accessToken);
      localStorage.setItem('pf_refreshToken', tokens.refreshToken);
      setCurrentUser(user);
      lastActivityRef.current = Date.now();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: 'Cannot connect to server. Is backend running?' };
    }
  }, []);

  const updateCurrentUser = useCallback((updates: Partial<User>) => {
    setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, updateCurrentUser, sessionWarning, extendSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
