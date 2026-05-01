import * as SecureStore from "expo-secure-store";
import { buildReceiptText, type ReceiptData } from "./receiptTemplate";

const PRINTER_KEY = "printer_mac";

export async function getSavedPrinterMac(): Promise<string | null> {
  return SecureStore.getItemAsync(PRINTER_KEY);
}

export async function savePrinterMac(mac: string): Promise<void> {
  await SecureStore.setItemAsync(PRINTER_KEY, mac);
}

export async function clearPrinterMac(): Promise<void> {
  await SecureStore.deleteItemAsync(PRINTER_KEY);
}

// Real implementation depends on react-native-bluetooth-escpos-printer.
// That module is a native dependency; install it after `expo prebuild` and
// import it here. For now, this is a stub that builds the receipt text.
export async function printReceipt(data: ReceiptData): Promise<{ ok: boolean; error?: string; preview: string }> {
  const preview = buildReceiptText(data);
  const mac = await getSavedPrinterMac();
  if (!mac) return { ok: false, error: "No printer paired", preview };

  try {
    // const { BluetoothEscposPrinter, BluetoothManager } = require("react-native-bluetooth-escpos-printer");
    // await BluetoothManager.connect(mac);
    // await BluetoothEscposPrinter.printerInit();
    // await BluetoothEscposPrinter.printText(preview, {});
    // await BluetoothEscposPrinter.cutLine();
    return { ok: true, preview };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Print failed", preview };
  }
}
