import * as SecureStore from "expo-secure-store";
import { PermissionsAndroid, Platform } from "react-native";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { buildReceiptText, type ReceiptData } from "./receiptTemplate";
import { LOGO_WIDTH_BYTES, LOGO_HEIGHT, LOGO_DATA } from "./logoRaster";

const PRINTER_KEY = "printer_mac";

// ─── Paired-printer persistence ───────────────────────────────────────────────
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
// DRAWER_KICK opens a cash drawer wired to the printer's RJ11 port (pin 2) — the
// "cashier" drawer is not a separate Bluetooth device, it hangs off the printer.
export const ESCPOS = {
  INIT: [0x1b, 0x40], // ESC @  — reset printer
  CUT: [0x1d, 0x56, 0x00], // GS V 0 — full cut
  DRAWER_KICK: [0x1b, 0x70, 0x00, 0x19, 0xfa], // ESC p 0 25 250 — open drawer
  ALIGN_CENTER: [0x1b, 0x61, 0x01], // ESC a 1
  ALIGN_LEFT: [0x1b, 0x61, 0x00], // ESC a 0
} as const;

// Center-aligned logo bitmap via GS v 0 (raster bit image). LOGO_DATA is a
// pre-rendered 1-bit monochrome raster (see logoRaster.ts).
function logoBytes(): number[] {
  return [
    ...ESCPOS.ALIGN_CENTER,
    0x1d, 0x76, 0x30, 0x00, // GS v 0, m = 0 (normal)
    LOGO_WIDTH_BYTES & 0xff, (LOGO_WIDTH_BYTES >> 8) & 0xff, // xL xH (bytes/row)
    LOGO_HEIGHT & 0xff, (LOGO_HEIGHT >> 8) & 0xff, // yL yH (rows)
    ...LOGO_DATA,
    0x0a, // line feed after the image
    ...ESCPOS.ALIGN_LEFT,
  ];
}

// ─── Bluetooth Classic (SPP) transport ────────────────────────────────────────

/** Android 12+ requires the BLUETOOTH_CONNECT runtime permission for bonded
 * devices + connect; the manifest permission alone is not enough. */
async function ensureBtPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (typeof Platform.Version === "number" && Platform.Version < 31) return true;
  const res = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  ]);
  return res["android.permission.BLUETOOTH_CONNECT"] === PermissionsAndroid.RESULTS.GRANTED;
}

export interface PairedDevice {
  name: string;
  address: string;
}

/** Bonded (already-paired-in-Android-settings) devices to choose from. */
export async function listPairedDevices(): Promise<PairedDevice[]> {
  const ok = await ensureBtPermissions();
  if (!ok) throw new Error("Bluetooth permission denied");
  if (!(await RNBluetoothClassic.isBluetoothEnabled())) {
    await RNBluetoothClassic.requestBluetoothEnabled();
  }
  const devices = await RNBluetoothClassic.getBondedDevices();
  return devices.map((d) => ({ name: d.name || d.address, address: d.address }));
}

/** Ensure there's an open connection to `mac`, reusing an existing one. */
async function connect(mac: string): Promise<void> {
  const connected = await RNBluetoothClassic.getConnectedDevices().catch(() => []);
  if (connected.some((d) => d.address === mac)) return;
  await RNBluetoothClassic.connectToDevice(mac);
}

async function sendBytes(mac: string, bytes: number[]): Promise<void> {
  await RNBluetoothClassic.writeToDevice(mac, toBase64(bytes), "base64");
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

  try {
    await ensureBtPermissions();
    await connect(mac);
    const payload = [
      ...ESCPOS.INIT,
      ...logoBytes(),
      ...textToBytes(preview),
      0x0a,
      0x0a,
      ...ESCPOS.CUT,
      ...(opts.openDrawer ? ESCPOS.DRAWER_KICK : []),
    ];
    await sendBytes(mac, payload);
    return { ok: true, preview };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Print failed", preview };
  }
}

/** Open the cash drawer without printing (e.g. a "no sale" drawer open). */
export async function kickCashDrawer(): Promise<{ ok: boolean; error?: string }> {
  const mac = await getSavedPrinterMac();
  if (!mac) return { ok: false, error: "No printer paired" };
  try {
    await ensureBtPermissions();
    await connect(mac);
    await sendBytes(mac, [...ESCPOS.DRAWER_KICK]);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Drawer open failed" };
  }
}

// ─── Encoding helpers ─────────────────────────────────────────────────────────

/** ASCII byte stream for the receipt text. Thermal printers use single-byte code
 * pages, so map the few non-ASCII glyphs we emit and drop anything else. */
function textToBytes(s: string): number[] {
  const ascii = s
    .replace(/—/g, "-")
    .replace(/×/g, "x")
    .replace(/₱/g, "P");
  const bytes: number[] = [];
  for (let i = 0; i < ascii.length; i++) {
    const c = ascii.charCodeAt(i);
    bytes.push(c > 0xff ? 0x3f /* '?' */ : c);
  }
  return bytes;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function toBase64(bytes: readonly number[]): string {
  // Raw bytes → base64 (what writeToDevice expects with encoding "base64"),
  // without depending on Buffer/btoa (neither is reliable in the RN runtime).
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
