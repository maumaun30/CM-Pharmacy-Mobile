// Replays the offline sales outbox FIFO to POST /sales.
//
// Each queued sale carries clientRef + soldAt; the server's create_sale RPC is
// idempotent on clientRef, so retrying after a half-failed drain is safe.
// A network error (no HTTP response) aborts the drain — still offline; an HTTP
// error records the message on the item and continues with the next sale.
import { createSale } from "@/api/sales";
import { getOutbox, removeFromOutbox, setOutboxError } from "./outbox";

let draining = false;

export interface SyncResult {
  synced: number;
  failed: number;
  aborted: boolean; // network died mid-drain
}

export async function syncOutbox(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, aborted: false };
  if (draining) return result;
  draining = true;
  try {
    const items = await getOutbox();
    for (const item of items) {
      try {
        await createSale({
          ...item.payload,
          clientRef: item.clientRef,
          soldAt: item.soldAt,
        });
        await removeFromOutbox(item.clientRef);
        result.synced++;
      } catch (e: any) {
        if (!e?.response) {
          // No HTTP response: connection is (still/again) down. Stop; the next
          // online transition or manual retry resumes from this item.
          result.aborted = true;
          break;
        }
        // Server rejected the sale (validation, auth, ...). Keep it queued with
        // the reason so the sales list can surface it, and move on.
        await setOutboxError(
          item.clientRef,
          e.response?.data?.message ?? `HTTP ${e.response?.status}`,
        );
        result.failed++;
      }
    }
    return result;
  } finally {
    draining = false;
  }
}
