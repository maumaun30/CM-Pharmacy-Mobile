import { useCallback, useRef, useState } from "react";
import type { TextInput } from "react-native";

export interface UseHidScannerOptions {
  onScan: (code: string) => void;
  minLength?: number;
}

export function useHidScanner({ onScan, minLength = 3 }: UseHidScannerOptions) {
  const inputRef = useRef<TextInput | null>(null);
  const [buffer, setBuffer] = useState("");
  const [lastScan, setLastScan] = useState<string | null>(null);

  const handleChange = useCallback((text: string) => {
    setBuffer(text);
  }, []);

  const handleSubmit = useCallback(() => {
    const code = buffer.trim();
    if (code.length >= minLength) {
      onScan(code);
      setLastScan(code);
    }
    setBuffer("");
  }, [buffer, minLength, onScan]);

  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return {
    inputRef,
    buffer,
    lastScan,
    handleChange,
    handleSubmit,
    focus,
  };
}
