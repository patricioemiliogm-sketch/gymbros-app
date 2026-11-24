import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, errorText, loadToken, Profile, setToken, setUnauthorizedHandler } from '../lib/api';

type AuthValue = {
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (fullName: string, email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    await setToken(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    (async () => {
      if (await loadToken()) {
        try {
          setProfile(await api<Profile>('/api/me'));
        } catch {
          // sin internet o sesión vencida: se pedirá ingresar de nuevo
        }
      }
      setLoading(false);
    })();
  }, [signOut]);

  const enter = async (path: string, body: unknown) => {
    try {
      const res = await api<{ token: string; user: Profile }>(path, { method: 'POST', body });
      await setToken(res.token);
      setProfile(res.user);
      return null;
    } catch (e) {
      return errorText(e);
    }
  };

  const value: AuthValue = {
    profile,
    loading,
    refreshProfile: async () => {
      try {
        setProfile(await api<Profile>('/api/me'));
      } catch {}
    },
    signIn: (email, password) => enter('/api/auth/login', { email: email.trim(), password }),
    signUp: (fullName, email, password) => enter('/api/auth/register', { full_name: fullName.trim(), email: email.trim(), password }),
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
