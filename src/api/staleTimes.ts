// Shared TanStack Query freshness tiers.
//
// staleTime is how long a cached result is served without hitting the API at
// all. Every screen mount inside that window is a request the droplet never
// sees, so the tier is chosen by how fast the data actually changes -- not by
// how important it feels.
export const STALE = {
  /** Near-static reference data: products, discounts, categories, branches. */
  COLD: 5 * 60_000,
  /** Moves with activity but is push-invalidated over the socket: sales, dashboard. */
  WARM: 60_000,
  /** Default for anything not explicitly tiered. */
  DEFAULT: 30_000,
} as const;
