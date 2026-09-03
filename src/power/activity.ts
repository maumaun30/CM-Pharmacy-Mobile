// Module-level activity signal.
//
// Touches are picked up by the responder capture in `PowerSaveProvider`, but
// some input never produces a touch at all — the HID barcode scanner types into
// a hidden TextInput. Anything that counts as "the cashier is using the app"
// calls `pokeActivity()`; the provider registers the single listener.
type Listener = () => void;

let listener: Listener | null = null;

export function setActivityListener(fn: Listener | null): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function pokeActivity(): void {
  listener?.();
}
