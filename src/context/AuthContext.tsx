import React, { createContext, useCallback, useContext, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { apiRequest, setApiToken } from '../services/api.ts';
import { UserProfile } from '../types/index.ts';

interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  loginWithPassword: (identifier: string, password: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<UserProfile>;
  bootstrapChairman: (data: {
    fullName: string;
    username: string;
    email: string;
    password: string;
  }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  updateLocalUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);

  const loginWithPassword = useCallback(async (identifier: string, password: string) => {
    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setApiToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await cred.user.getIdToken();
    const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    setApiToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const bootstrapChairman = useCallback(
    async (data: { fullName: string; username: string; email: string; password: string }) => {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/bootstrap', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setApiToken(res.token);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    setApiToken(null);
    setUser(null);
    try {
      await signOut(auth);
    } catch {
      // Ignore if not signed in via Firebase
    }
  }, []);

  const updateLocalUser = useCallback((nextUser: UserProfile) => {
    setUser(nextUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loginWithPassword,
        loginWithGoogle,
        bootstrapChairman,
        logout,
        updateLocalUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
