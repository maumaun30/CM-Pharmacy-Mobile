// src/auth/permissions.ts
// Client-side mirror of the API's permission model. The role→permission matrix
// lives ONLY on the API (config/permissions.js); the app reads the expanded
// `permissions` array the API returns on /auth/me and asks `can(user, key)`.
// Never gate on a hardcoded role string — gate on the capability.

import type { AuthUser } from "@/auth/AuthContext";

/** Does the current user hold a given permission? Wildcards are respected. */
export function can(
  user: Pick<AuthUser, "permissions"> | null | undefined,
  permission: string,
): boolean {
  if (!user) return false;
  const perms = user.permissions ?? [];
  if (perms.includes("*") || perms.includes(permission)) return true;
  const resource = permission.split(".")[0];
  return perms.includes(`${resource}.*`);
}

/** True if the user holds ANY of the listed permissions. */
export function canAny(
  user: Pick<AuthUser, "permissions"> | null | undefined,
  permissions: string[],
): boolean {
  return permissions.some((p) => can(user, p));
}
