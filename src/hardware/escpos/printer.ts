import * as SecureStore from "expo-secure-store";
import { buildReceiptText, type ReceiptData } from "./receiptTemplate";

const PRINTER_KEY = "printer_mac";

// ─── Paired-printer persistence (works today, no hardware needed) ─────────────
export async function getSavedPrinterMac(): Promise<string | null> {
  return SecureStore.getItemAsync(PRINTER_KEY);
}
export async function savePrinterMac(mac: string): Promise<void> {
  await SecureStore.setItemAsync(PRINTER_KEY, mac);
}
export async function clearPrinterMac(): Promise<void> {
  await SecureStore.deleteItemAsync(PRINTER_KEY);
}

// ─── ESC/POS raw command sequences ────────────────────────────────────────────
// Standard ESC/POS control codes. `DRAWER_KICK` opens a cash drawer wired to the
// printer's RJ11 port (pin 2, 25ms/250ms pulse) — this is how the "cashier"
// drawer is triggered: it is not a separate Bluetooth device, it hangs off the
// thermal printer.
export const ESCPOS = {
  INIT: [0x1b, 0x40], // ESC @  — reset printer
  CUT: [0x1d, 0x56, 0x00], // GS V 0 — full cut
  DRAWER_KICK: [0x1b, 0x70, 0x00, 0x19, 0xfa], // ESC p 0 25 250 — open drawer
} as const;

// ─── Native module wiring (single point) ──────────────────────────────────────
// Real Bluetooth printing needs `react-native-bluetooth-escpos-printer`, a native
// module that only runs in a custom dev build (NOT Expo Go). Install it after
// `expo prebuild`, then uncomment the require below — every function routes
// through `getPrinter()` so this is the only place to wire it.
//
//   npx expo install react-native-bluetooth-escpos-printer
//   npx expo prebuild && npx expo run:android
type BtPrinter = {
  BluetoothManager: { connect(mac: string): Promise<void> };
  BluetoothEscposPrinter: {
    printerInit(): Promise<void>;
    printText(text: string, opts: object): Promise<void>;
    printRaw(base64: string): Promise<void>;
    cutLine(): Promise<void>;
  };
};

function getPrinter(): BtPrinter | null {
  try {
    // return require("react-native-bluetooth-escpos-printer");
    return null; // stub until the native module + a dev build are in place
  } catch {
    return null;
  }
}

export type PrinterResult = { ok: boolean; error?: string; preview: string };

/** Print a receipt (and optionally open the cash drawer) to the paired printer. */
export async function printReceipt(
  data: ReceiptData,
  opts: { openDrawer?: boolean } = {},
): Promise<PrinterResult> {
  const preview = buildReceiptText(data);
  const mac = await getSavedPrinterMac();
  if (!mac) return { ok: false, error: "No printer paired", preview };

  const printer = getPrinter();
  if (!printer) {
    // No native module yet: surface the built receipt so callers can show a
    // preview and the flow stays testable without hardware.
    return { ok: false, error: "Printer module not installed (dev build required)", preview };
  }

  try {
    await printer.BluetoothManager.connect(mac);
    await printer.BluetoothEscposPrinter.printerInit();
    await printer.BluetoothEscposPrinter.printText(preview, {});
    await printer.BluetoothEscposPrinter.cutLine();
    if (opts.openDrawer) {
      await printer.BluetoothEscposPrinter.printRaw(toBase64(ESCPOS.DRAWER_KICK));
    }
    return { ok: true, preview };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Print failed", preview };
  }
}

/** Open the cash drawer without printing (e.g. a "no sale" drawer open). */
export async function kickCashDrawer(): Promise<{ ok: boolean; error?: string }> {
  const mac = await getSavedPrinterMac();
  if (!mac) return { ok: false, error: "No printer paired" };
  const printer = getPrinter();
  if (!printer) return { ok: false, error: "Printer module not installed (dev build required)" };
  try {
    await printer.BluetoothManager.connect(mac);
    await printer.BluetoothEscposPrinter.printRaw(toBase64(ESCPOS.DRAWER_KICK));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Drawer open failed" };
  }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function toBase64(bytes: readonly number[]): string {
  // ESC/POS raw bytes → base64 (what printRaw expects), without depending on
  // Buffer/btoa (neither is reliably present in the RN runtime).
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 0x0f) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 0x3f] : "=";
  }
  return out;
}
