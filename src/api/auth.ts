import api from "./client";
import type { AuthUser } from "@/auth/AuthContext";

export async function login(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await api.post("/auth/login", { username, password });
  return res.data;
}

export async function me(): Promise<AuthUser> {
  const res = await api.get("/auth/me");
  return res.data;
}

/** Change the signed-in user's own password (verifies the current one). */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.put("/auth/change-password", { currentPassword, newPassword });
}

// ─── Google account linking ───────────────────────────────────────────────────

/** Exchange a Google ID token for our JWT. 401 = Google account not linked yet. */
export async function googleLogin(
  idToken: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await api.post("/auth/google", { idToken });
  return res.data;
}

/** Attach the signed-in user's Google account (verified by the ID token). */
export async function linkGoogle(idToken: string): Promise<void> {
  await api.post("/auth/google/link", { idToken });
}

export async function unlinkGoogle(): Promise<void> {
  await api.delete("/auth/google/link");
}
