// Idle power saving for the POS tablet.
//
// Goal: after a stretch with no cashier activity, drop the backlight instead of
// letting Android black the screen out. The register stays glanceable (clock is
// still readable) and the first tap wakes it without hitting whatever button
// happened to be under the finger.
//
// Three moving parts:
//   1. Activity detection — a responder *capture* handler on the root view sees
//      every touch without ever claiming it (returns false), plus
//      `pokeActivity()` for input that produces no touch (barcode scanner).
//   2. Backlight — `Brightness.setBrightnessAsync` overrides the brightness of
//      this activity only. No WRITE_SETTINGS permission, and Android restores
//      the system value on its own if the app dies.
//   3. Keep-awake — dimming only reads as "dimmed, not off" while the OS screen
//      timeout is suppressed. We release keep-awake again after a longer idle
//      so an unplugged tablet does not stay lit all night.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Modal, Platform, Text, View } from "react-native";
import * as Brightness from "expo-brightness";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import Animated, { FadeIn } from "react-native-reanimated";
import { Moon } from "lucide-react-native";
import dayjs from "dayjs";
import { setActivityListener } from "./activity";
import {
  DEFAULT_PREFS,
  loadPowerPrefs,
  savePowerPrefs,
  type PowerPrefs,
} from "./settings";

const KEEP_AWAKE_TAG = "pos-power-save";
/** Re-arming on every touch move would thrash timers during a fling. */
const POKE_THROTTLE_MS = 1500;

interface PowerSaveValue {
  prefs: PowerPrefs;
  dimmed: boolean;
  updatePrefs: (patch: Partial<PowerPrefs>) => void;
  /** Dim immediately — used by the "Preview" button in Settings. */
  dimNow: () => void;
  wake: () => void;
}

const PowerSaveContext = createContext<PowerSaveValue | null>(null);

export function PowerSaveProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<PowerPrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [dimmed, setDimmed] = useState(false);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const dimmedRef = useRef(false);
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBrightness = useRef<number | null>(null);
  const keptAwake = useRef(false);
  const lastPoke = useRef(0);
  const dimGen = useRef(0);

  const clearTimers = useCallback(() => {
    if (dimTimer.current) clearTimeout(dimTimer.current);
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    dimTimer.current = null;
    sleepTimer.current = null;
  }, []);

  const restoreBrightness = useCallback(async () => {
    try {
      if (Platform.OS === "android") {
        // Hands the activity back to the system brightness (and auto-brightness).
        await Brightness.restoreSystemBrightnessAsync();
      } else if (prevBrightness.current != null) {
        await Brightness.setBrightnessAsync(prevBrightness.current);
      }
    } catch {
      // Brightness control is a nicety; never let it break the register.
    }
    prevBrightness.current = null;
  }, []);

  const setKeepAwake = useCallback(async (on: boolean) => {
    try {
      if (on && !keptAwake.current) {
        await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
        keptAwake.current = true;
      } else if (!on && keptAwake.current) {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
        keptAwake.current = false;
      }
    } catch {
      // ignore
    }
  }, []);

  const dim = useCallback(async () => {
    if (dimmedRef.current) return;
    const p = prefsRef.current;
    // The brightness calls are async, so a touch landing mid-dim would otherwise
    // let the screen darken right after the cashier touched it. Every wake bumps
    // this counter; a stale dim bails out.
    const gen = ++dimGen.current;
    try {
      prevBrightness.current = await Brightness.getBrightnessAsync();
      if (dimGen.current !== gen) return;
      await Brightness.setBrightnessAsync(p.dimLevel);
      if (dimGen.current !== gen) {
        void restoreBrightness();
        return;
      }
    } catch {
      // If the backlight cannot be lowered we still show the overlay, which at
      // least blanks the UI and swallows the wake tap.
      if (dimGen.current !== gen) return;
    }
    dimmedRef.current = true;
    setDimmed(true);
  }, [restoreBrightness]);

  const arm = useCallback(() => {
    clearTimers();
    const p = prefsRef.current;
    if (!p.enabled) return;
    dimTimer.current = setTimeout(() => {
      void dim();
    }, p.dimAfterSec * 1000);
    if (p.sleepAfterSec > 0) {
      sleepTimer.current = setTimeout(() => {
        void setKeepAwake(false);
      }, p.sleepAfterSec * 1000);
    }
  }, [clearTimers, dim, setKeepAwake]);

  const wake = useCallback(() => {
    dimGen.current++; // cancels any dim that is mid-flight
    if (dimmedRef.current) {
      dimmedRef.current = false;
      setDimmed(false);
      void restoreBrightness();
    }
    if (prefsRef.current.enabled) {
      void setKeepAwake(true);
      arm();
    } else {
      clearTimers();
    }
  }, [arm, clearTimers, restoreBrightness, setKeepAwake]);

  const poke = useCallback(() => {
    if (dimmedRef.current) {
      wake();
      return;
    }
    const now = Date.now();
    if (now - lastPoke.current < POKE_THROTTLE_MS) return;
    lastPoke.current = now;
    wake();
  }, [wake]);

  const dimNow = useCallback(() => {
    clearTimers();
    void dim();
  }, [clearTimers, dim]);

  const updatePrefs = useCallback((patch: Partial<PowerPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void savePowerPrefs(next);
      return next;
    });
  }, []);

  // Load saved preferences once.
  useEffect(() => {
    let alive = true;
    loadPowerPrefs().then((saved) => {
      if (!alive) return;
      setPrefs(saved);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Apply preferences: arm the timers, or undo everything when switched off.
  useEffect(() => {
    if (!ready) return;
    if (prefs.enabled) {
      void setKeepAwake(true);
      arm();
    } else {
      clearTimers();
      if (dimmedRef.current) {
        dimmedRef.current = false;
        setDimmed(false);
        void restoreBrightness();
      }
      void setKeepAwake(false);
    }
  }, [
    ready,
    prefs.enabled,
    prefs.dimAfterSec,
    prefs.sleepAfterSec,
    arm,
    clearTimers,
    restoreBrightness,
    setKeepAwake,
  ]);

  // Non-touch activity (barcode scans) resets the idle clock too.
  useEffect(() => setActivityListener(poke), [poke]);

  // Leaving the app must hand the backlight back; Android would otherwise keep
  // the dimmed override on this activity when the cashier returns via recents.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        wake();
      } else {
        clearTimers();
        if (dimmedRef.current) {
          dimmedRef.current = false;
          setDimmed(false);
        }
        void restoreBrightness();
        void setKeepAwake(false);
      }
    });
    return () => sub.remove();
  }, [clearTimers, restoreBrightness, setKeepAwake, wake]);

  useEffect(
    () => () => {
      clearTimers();
      void restoreBrightness();
      void setKeepAwake(false);
    },
    [clearTimers, restoreBrightness, setKeepAwake],
  );

  const onTouchCapture = useCallback(() => {
    poke();
    return false; // observe only — never steal the touch from the POS UI
  }, [poke]);

  const value = useMemo<PowerSaveValue>(
    () => ({ prefs, dimmed, updatePrefs, dimNow, wake }),
    [prefs, dimmed, updatePrefs, dimNow, wake],
  );

  return (
    <PowerSaveContext.Provider value={value}>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={onTouchCapture}
        onMoveShouldSetResponderCapture={onTouchCapture}
      >
        {children}
        <DimOverlay visible={dimmed} onWake={wake} />
      </View>
    </PowerSaveContext.Provider>
  );
}

export function usePowerSave(): PowerSaveValue {
  const ctx = useContext(PowerSaveContext);
  if (!ctx) throw new Error("usePowerSave must be used inside <PowerSaveProvider>");
  return ctx;
}

/**
 * The overlay is a Modal on purpose: RN modals render in their own native
 * window, so this still covers (and swallows taps meant for) the checkout or
 * printer modals if the register goes idle with one of them open.
 */
function DimOverlay({ visible, onWake }: { visible: boolean; onWake: () => void }) {
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    if (!visible) return;
    setNow(dayjs());
    const id = setInterval(() => setNow(dayjs()), 20_000);
    return () => clearInterval(id);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onWake}
    >
      <View
        className="flex-1 items-center justify-center bg-black/80"
        onStartShouldSetResponder={() => true}
        onResponderRelease={onWake}
      >
        <Animated.View entering={FadeIn.duration(400)} className="items-center">
          <Moon size={22} color="#334155" />
          <Text className="mt-3 text-6xl font-light tracking-tight text-slate-300">
            {now.format("h:mm")}
            <Text className="text-2xl font-light text-slate-500"> {now.format("A")}</Text>
          </Text>
          <Text className="mt-1 text-xs text-slate-500">{now.format("dddd, MMM D")}</Text>
          <Text className="mt-8 text-[11px] uppercase tracking-widest text-slate-600">
            Tap anywhere to resume
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}
