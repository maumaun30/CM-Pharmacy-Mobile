import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

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

    const socket = io(url, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-branch", branchId);
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("stock-updated", (p) => eventsRef.current.onStockUpdated?.(p));
    socket.on("new-sale", (p) => eventsRef.current.onNewSale?.(p));
    socket.on("low-stock-alert", (p) => eventsRef.current.onLowStockAlert?.(p));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [branchId]);

  return { connected, socket: socketRef.current };
}
