# Maun Pharmacy Mobile (POS)

Cashier-only Android tablet app for the Maun Pharmacy POS. Wraps the existing Express + Postgres/Drizzle backend (`../CM-Pharmacy-API`) — no API changes — with a native UI sized for an Android tablet at the counter, a paired Bluetooth HID barcode scanner, and a paired Bluetooth ESC/POS thermal receipt printer (with a cash drawer on its RJ11 port).

## Status

- **v1 scope:** login, POS (search / scan / cart / discounts / checkout / receipt), sales list, sale detail, refunds, printer pairing, sign out.
- **Out of scope (v1):** admin/manager screens, dashboard, stock/product/discount/category/user/branch/log management, branch switching, offline queue, iOS, phone form factor.

## Stack

- Expo SDK 54 + Expo Router v6 (file-based routes under `app/`)
- React Native 0.81, React 19, TypeScript
- NativeWind v4 + Tailwind v3.4 for styling
- TanStack Query v5 for server state
- axios + socket.io-client (reused from web)
- expo-secure-store for the JWT
- @shopify/flash-list (product grid / sales list)
- @gorhom/bottom-sheet (discount picker, checkout, refund picker)
- react-native-reanimated + react-native-gesture-handler
- lucide-react-native for icons
- `react-native-bluetooth-escpos-printer` for receipt printing — requires a custom dev client (not Expo Go)

## Project layout

```
CM-Pharmacy-Mobile/
├── app/                      # Expo Router
│   ├── _layout.tsx           # Providers: GestureHandler, BottomSheet, Query, Auth, Stack
│   ├── index.tsx             # Redirects to /login or /(app)/pos
│   ├── login.tsx
│   └── (app)/                # auth-gated tab group
│       ├── _layout.tsx       # Tabs: POS | Sales | Settings
│       ├── pos.tsx
│       ├── sales/
│       │   ├── index.tsx
│       │   └── [id].tsx
│       └── settings.tsx
├── src/
│   ├── api/                  # axios client + endpoint wrappers
│   ├── auth/AuthContext.tsx
│   ├── socket/useBranchSocket.ts
│   ├── hardware/
│   │   ├── useHidScanner.ts          # hidden TextInput pattern
│   │   └── escpos/
│   │       ├── printer.ts            # SecureStore-paired MAC, BluetoothEscposPrinter
│   │       └── receiptTemplate.ts    # 32-col receipt builder
│   └── pos/useCart.ts
├── app.json                  # Android perms + Expo plugins
├── babel.config.js           # nativewind/babel + reanimated/plugin
├── metro.config.js           # withNativeWind
├── tailwind.config.js
└── global.css
```

## Prerequisites

- Node 20+
- Android Studio with an SDK + a device/emulator
- The API running and reachable from the tablet (LAN IP + port, e.g. `http://192.168.1.50:5000`)
- An Android tablet with Developer Mode + USB debugging (or a paired wireless ADB)
- A paired Bluetooth HID barcode scanner (acts as a keyboard)
- A paired Bluetooth ESC/POS thermal printer (Classic Bluetooth)

## Environment

Copy `.env.example` to `.env` and set:

```
EXPO_PUBLIC_API_BASE_URL=http://<lan-ip>:5000/api
EXPO_PUBLIC_SOCKET_URL=http://<lan-ip>:5000
EXPO_PUBLIC_SITE_NAME=Maun Pharmacy
```

The tablet must be able to reach `<lan-ip>` — same Wi-Fi as the dev machine, no firewall blocking the API port.

The API also needs `CLIENT_URL` set to a value that allows the tablet origin (or `*` in dev) — see `../CM-Pharmacy-API/app.js` and `utils/socket.js`.

## First run (dev client)

`react-native-bluetooth-escpos-printer` is a native module, so Expo Go can't load it. You build a custom dev client once, then iterate normally.

```bash
# 1. Install JS deps (use legacy peer deps — @gorhom/bottom-sheet's React peer is strict)
npm install --legacy-peer-deps

# 2. Generate native android/ project
npx expo prebuild --platform android

# 3. Build & install the dev client on a connected tablet
npm run android

# 4. From then on, iterate with the Metro dev server
npm start
```

For team distribution use EAS:

```bash
npx eas build --profile development --platform android   # signed dev-client APK
npx eas build --profile production  --platform android   # release APK/AAB
```

## Hardware integration

### Bluetooth HID barcode scanner
Pair the scanner to Android once (it shows up as a keyboard). The POS screen renders a hidden, focused `TextInput` (`autoFocus`, `caretHidden`, opacity 0). Each scan ends in `\r`, which fires `onSubmitEditing` — the buffer is matched against `barcode` then `sku` (case-insensitive, `status === "ACTIVE"`) and the product is added to the cart. See `src/hardware/useHidScanner.ts`.

### Bluetooth ESC/POS thermal printer
Pair the printer to Android once. Open Settings inside the app, tap **Pair printer**, pick the device — its MAC is saved to SecureStore (`printer_mac`). After every successful sale we render the 32-column receipt template and send the bytes to the saved MAC. If pairing is missing or the device is out of range, the in-app receipt modal is shown as a fallback with a **Try Print** button.

## Backend contracts (unchanged)

- `POST /auth/login` → `{ token, user }`
- `GET /auth/me` → `user`
- `GET /products?branchId=` → `Product[]` (with `branch_stocks`)
- `POST /sales` body `{ cart, subtotal, totalDiscount, total, cashAmount }`
- `GET /sales`, `GET /sales/:id`
- `POST /sales/:id/refunds` body `{ items: [{ saleItemId, quantity }], reason? }`
- Socket.IO: client emits `join-branch` with the branch id; server emits `stock-updated`, `new-sale`, `low-stock-alert` to the `branch-${id}` room.

The Postgres `create_sale` RPC still owns the stock-deduction transaction — same as the web app.

## Useful scripts

| Command           | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `npm start`       | Metro bundler with the dev-client target             |
| `npm run android` | Build native Android project and install on device   |
| `npm run prebuild`| Re-generate `android/` (after adding a native dep)   |
| `npx tsc --noEmit`| Typecheck                                            |

## Troubleshooting

- **Metro can't reach API:** confirm tablet and dev machine are on the same network and the API port is open. Try `curl http://<lan-ip>:5000/` from the tablet's browser.
- **CORS / Socket.IO refused:** set `CLIENT_URL` in the API `.env` to allow the tablet origin (or `*` in dev) and restart the API.
- **Scanner does nothing:** tap the POS background to refocus the hidden input. If a sheet is open, the scanner is intentionally inert until it closes.
- **Printer prints garbage:** confirm the printer is 80mm and uses ESC/POS. Pair fresh from Settings; the cached MAC may be stale.
- **`@gorhom/bottom-sheet` install fails:** re-run with `--legacy-peer-deps`.
- **Native module changes don't show up:** run `npx expo prebuild --clean` then `npm run android`.

## Peripherals (scanner / printer / cash drawer)

| Device | Status | Notes |
|---|---|---|
| **Barcode scanner** (USB/Bluetooth HID) | ✅ Works now, no build needed | Acts as a keyboard: `useHidScanner` + a hidden auto-focused input on the POS screen capture the scan + Enter. Pair it in Android settings; each scan adds the matching product. |
| **Thermal printer** (Bluetooth ESC/POS, 80mm) | 🔧 Scaffolded; needs a dev build | `src/hardware/escpos/` builds the receipt + raw commands. Real printing needs the native module + a custom dev build (below). |
| **Cash drawer** ("cashier") | 🔧 Via the printer | Not a separate device — it hangs off the printer's RJ11 port and opens with the `ESCPOS.DRAWER_KICK` byte sequence (`printReceipt(data, { openDrawer: true })` or `kickCashDrawer()`). |

Bluetooth + location permissions are already declared in `app.json`. To finish the printer/drawer:

```bash
npx expo install react-native-bluetooth-escpos-printer
# then uncomment the require() in src/hardware/escpos/printer.ts (getPrinter)
npx expo prebuild --clean
npx expo run:android          # custom dev build — NOT Expo Go
```

## Related

- `../CM-Pharmacy-API` — Express + Postgres/Drizzle backend (unchanged for the mobile app)
- `../CM-Pharmacy-UI` — Next.js admin/POS web app (full feature set)
