import axios from "axios";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "token";

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Expired / invalid session handling ──────────────────────────────────────
// When the API rejects a request with 401 (e.g. the JWT expired), drop the stale
// token and let the app return to the login screen. AuthContext registers the
// handler below so this module stays free of navigation/React concerns.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    // Don't hijack a failed sign-in: the login screen surfaces those 401s itself.
    const isLoginAttempt = url.includes("/auth/login");
    if (status === 401 && !isLoginAttempt) {
      await clearToken();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export default api;
