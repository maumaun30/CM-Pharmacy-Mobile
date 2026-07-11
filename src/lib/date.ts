import dayjs, { type Dayjs } from "dayjs";

// The API returns Postgres timestamptz values as their raw wire format, e.g.
// "2026-07-11 12:54:02.385129+00" (space separator, no "T", bare "+00" offset).
// Browsers (V8) parse this leniently, but React Native's Hermes engine returns
// Invalid Date. Normalize to ISO 8601 before handing it to dayjs/Date.
//
//   "2026-07-11 12:54:02.385129+00"  ->  "2026-07-11T12:54:02.385129+00:00"
export function fromApi(value?: string | null): Dayjs {
  if (!value) return dayjs(NaN); // Invalid Date, so callers can guard with .isValid()
  const iso = value
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00"); // "+00" -> "+00:00" (ISO requires the colon)
  return dayjs(iso);
}
