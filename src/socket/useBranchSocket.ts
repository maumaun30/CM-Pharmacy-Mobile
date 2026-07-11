import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getToken } from "@/api/client";

export interface BranchSocketEvents {
  onStockUpdated?: (payload: any) => void;
  onNewSale?: (payload: any) => void;
  onLowStockAlert?: (payload: any) => void;
}

export function useBranchSocket(branchId: number | null | undefined, events: BranchSocketEvents) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const eventsRef = useRef<BranchSocketEvents>(events);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (!branchId) return;
    const url = process.env.EXPO_PUBLIC_SOCKET_URL;
    if (!url) return;

    let socket: Socket | null = null;
    let cancelled = false;

    // The server now requires a valid JWT on the socket handshake, so fetch the
    // token (from SecureStore) before connecting.
    (async () => {
      const token = await getToken();
      if (cancelled || !token) return;

      // Lead with HTTP long-polling, then upgrade to websocket if the network
      // allows it. Some tablet networks / proxies block the wss handshake, and a
      // websocket-first config loops on "websocket error" instead of falling
      // back. Polling-first connects immediately and upgrades opportunistically.
      socket = io(url, {
        transports: ["polling", "websocket"],
        auth: { token },
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);
        socket?.emit("join-branch", branchId);
      });
      socket.on("disconnect", () => setConnected(false));

      socket.on("stock-updated", (p) => eventsRef.current.onStockUpdated?.(p));
      socket.on("new-sale", (p) => eventsRef.current.onNewSale?.(p));
      socket.on("low-stock-alert", (p) => eventsRef.current.onLowStockAlert?.(p));
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [branchId]);

  return { connected, socket: socketRef.current };
}
