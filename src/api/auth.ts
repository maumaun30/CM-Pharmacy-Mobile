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
