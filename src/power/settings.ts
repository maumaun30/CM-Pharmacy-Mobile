// Persisted power-saving preferences.
//
// Non-secret device preference, so this uses AsyncStorage (SecureStore is
// reserved for the token and the printer MAC). Reads are cheap and only happen
// on mount; every write goes through `savePowerPrefs` so the shape stays valid.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "power_save_prefs";

export interface PowerPrefs {
  /** Master switch. When false the app never touches brightness or keep-awake. */
  enabled: boolean;
  /** Idle seconds before the screen dims. */
  dimAfterSec: number;
  /** Backlight level (0..1) while dimmed. */
  dimLevel: number;
  /**
   * Idle seconds before we release keep-awake and let Android's own screen
   * timeout take over. Without this an unplugged tablet would stay lit (dim,
   * but lit) all night.
   */
  sleepAfterSec: number;
}

export const DEFAULT_PREFS: PowerPrefs = {
  enabled: true,
  dimAfterSec: 90,
  dimLevel: 0.05,
  sleepAfterSec: 600,
};

/** Options offered in Settings. Values are seconds. */
export const DIM_AFTER_CHOICES = [30, 60, 90, 180, 300] as const;
export const SLEEP_AFTER_CHOICES = [300, 600, 1800, 0] as const; // 0 = never sleep
export const DIM_LEVEL_CHOICES = [
  { label: "Darkest", value: 0.02 },
  { label: "Dim", value: 0.05 },
  { label: "Soft", value: 0.15 },
] as const;

export function formatDuration(sec: number): string {
  if (sec === 0) return "Never";
  if (sec < 60) return `${sec}s`;
  const min = sec / 60;
  return Number.isInteger(min) ? `${min} min` : `${min.toFixed(1)} min`;
}

export async function loadPowerPrefs(): Promise<PowerPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<PowerPrefs>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_PREFS.enabled,
      dimAfterSec: numOr(parsed.dimAfterSec, DEFAULT_PREFS.dimAfterSec),
      dimLevel: clamp01(numOr(parsed.dimLevel, DEFAULT_PREFS.dimLevel)),
      sleepAfterSec: numOr(parsed.sleepAfterSec, DEFAULT_PREFS.sleepAfterSec),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePowerPrefs(prefs: PowerPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Preference persistence is best-effort; the in-memory value still applies.
  }
}

function numOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
