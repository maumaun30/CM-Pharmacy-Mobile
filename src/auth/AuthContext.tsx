import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { clearToken, getToken, setToken, setUnauthorizedHandler } from "@/api/client";
import {
  login as loginApi,
  me as meApi,
  googleLogin as googleLoginApi,
  linkGoogle as linkGoogleApi,
  unlinkGoogle as unlinkGoogleApi,
} from "@/api/auth";

export interface AuthBranch {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  tin?: string | null;
}

export interface AuthUser {
  id: number;
  username: string;
  email?: string;
  role: "admin" | "manager" | "cashier";
  // Expanded capability list from the API (config/permissions.js). Gate UI via
  // the `can()` helper in src/auth/permissions.ts, never on `role` directly.
  permissions?: string[];
  first_name: string;
  last_name: string;
  contact_number?: string;
  branch_id: number;
  current_branch_id: number | null;
  is_active: boolean;
  branch?: AuthBranch;
  currentBranch?: AuthBranch;
  // Google account linking (from /auth/me). google_linked is derived server-side.
  google_linked?: boolean;
  google_email?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  linkGoogle: (idToken: string) => Promise<void>;
  unlinkGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  linkGoogle: async () => {},
  unlinkGoogle: async () => {},
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

  // If any API call 401s (expired/invalid token), reset to a signed-out state so
  // the router sends the user back to /login. The token is already cleared by the
  // interceptor before this fires.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  // Superadmin logins never return a token here — the API answers with a TOTP
  // challenge that only the web UI implements.
  const assertNotTotpChallenge = (res: Record<string, unknown>) => {
    if (res.requires_totp || res.requires_totp_setup) {
      throw new Error("Superadmin must use the web app.");
    }
  };

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await loginApi(username, password);
    assertNotTotpChallenge(res as unknown as Record<string, unknown>);
    await setToken(res.token);
    const full = await meApi();
    setUser(full);
  }, []);

  // Google login: exchange the Google ID token for our JWT (same shape as signIn).
  const signInWithGoogle = useCallback(async (idToken: string) => {
    const res = await googleLoginApi(idToken);
    assertNotTotpChallenge(res as unknown as Record<string, unknown>);
    await setToken(res.token);
    const full = await meApi();
    setUser(full);
  }, []);

  // Link/unlink the currently signed-in user's Google account, then re-fetch so
  // google_linked/google_email update in the UI.
  const linkGoogle = useCallback(
    async (idToken: string) => {
      await linkGoogleApi(idToken);
      await refreshUser();
    },
    [refreshUser],
  );

  const unlinkGoogle = useCallback(async () => {
    await unlinkGoogleApi();
    await refreshUser();
  }, [refreshUser]);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signInWithGoogle,
        linkGoogle,
        unlinkGoogle,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
