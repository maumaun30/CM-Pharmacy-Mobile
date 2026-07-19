// Online/offline state + automatic outbox drain.
//
// `useOffline` is the single hook screens use: it reports whether the device
// can reach the network, how many sales are queued, and exposes a manual
// `syncNow`. Mounted once in the (app) layout, the auto-drain effect replays
// the outbox whenever connectivity returns; extra mounts are harmless because
// syncOutbox self-guards against concurrent drains.
import { useCallback, useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { getOutbox, subscribeOutbox } from "./outbox";
import { syncOutbox } from "./sync";
import { toast } from "burnt";

export function useOffline() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(() => {
    getOutbox().then((items) => setPendingCount(items.length));
  }, []);

  const syncNow = useCallback(async () => {
    const res = await syncOutbox();
    if (res.synced > 0) {
      // Server state moved: stock deducted, sales created — refetch everything.
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast({
        title: `${res.synced} offline ${res.synced === 1 ? "sale" : "sales"} synced`,
        preset: "done",
      });
    }
    return res;
  }, [queryClient]);

  useEffect(() => {
    refreshPending();
    return subscribeOutbox(refreshPending);
  }, [refreshPending]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline =
        !!state.isConnected && state.isInternetReachable !== false;
      setOnline((prev) => {
        if (!prev && isOnline) {
          // Came back online: drain the queue.
          syncNow();
        }
        return isOnline;
      });
    });
    return unsubscribe;
  }, [syncNow]);

  return { online, pendingCount, syncNow };
}
