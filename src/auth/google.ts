// Native Google sign-in wrapper. Produces a Google ID token (JWT) that the API
// verifies at /auth/google[/link]. We pass the WEB client id as `webClientId` so
// the returned token is audienced to the same Web client the backend trusts —
// see CM-Pharmacy-API/config/google.js (GOOGLE_CLIENT_IDS allow-list).

import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined;

/** True when a Web client id is present — gate the Google UI on this. */
export const googleConfigured = Boolean(webClientId);

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId,
    iosClientId,
    scopes: ["email", "profile"],
    offlineAccess: false, // we only need the ID token, not a server auth code
  });
  configured = true;
}

/** User dismissed the Google sheet — callers treat this as a no-op, not an error. */
export class GoogleCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "GoogleCancelled";
  }
}

/**
 * Open the native Google account sheet and return a fresh ID token.
 * @throws {GoogleCancelled} if the user dismisses the sheet
 * @throws {Error} if Google sign-in is unconfigured or no token is returned
 */
export async function getGoogleIdToken(): Promise<string> {
  if (!webClientId) throw new Error("Google sign-in is not configured");
  ensureConfigured();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // Clear any cached session so the account chooser always appears — important
  // for linking, where the user may want a different account than last time.
  try {
    await GoogleSignin.signOut();
  } catch {
    // no active session — ignore
  }

  try {
    const response = await GoogleSignin.signIn();
    if (isSuccessResponse(response)) {
      const idToken = response.data.idToken;
      if (!idToken) throw new Error("Google did not return an ID token");
      return idToken;
    }
    // response.type === "cancelled"
    throw new GoogleCancelled();
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new GoogleCancelled();
    }
    throw err;
  }
}
