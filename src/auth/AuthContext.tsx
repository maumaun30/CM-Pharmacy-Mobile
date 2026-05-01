import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { clearToken, getToken, setToken } from "@/api/client";
import { login as loginApi, me as meApi } from "@/api/auth";

export interface AuthUser {
  id: number;
  username: string;
  email?: string;
  role: "admin" | "manager" | "cashier";
  first_name: string;
  last_name: string;
  contact_number?: string;
  branch_id: number;
  current_branch_id: number | null;
  is_active: boolean;
  branch?: { id: number; name: string; code: string; is_active: boolean };
  currentBranch?: { id: number; name: string; code: string; is_active: boolean };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await meApi();
      setUser(data);
    } catch {
      await clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const signIn = useCallback(async (username: string, password: string) => {
    const { token } = await loginApi(username, password);
    await setToken(token);
    const full = await meApi();
    setUser(full);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
