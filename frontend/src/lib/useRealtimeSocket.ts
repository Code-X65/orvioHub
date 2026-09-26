import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ORIGIN } from './config';

export type RealtimeEvent = { id?: string; type: string; at?: string; [key: string]: unknown };

/** Reconnecting cookie-authenticated WebSocket with bounded exponential backoff. */
export function useRealtimeSocket(path: string | null, onEvent: (event: RealtimeEvent) => void) {
  const onEventRef = useRef(onEvent);
  const socketRef = useRef<WebSocket | null>(null);
  const attempts = useRef(0);
  const [connected, setConnected] = useState(false);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => {
    if (!path) return;
    let disposed = false; let reconnect: number | undefined;
    const connect = () => {
      const socket = new WebSocket(`${API_ORIGIN.replace(/^http/, 'ws')}${path}`);
      socketRef.current = socket;
      socket.onopen = () => { attempts.current = 0; setConnected(true); };
      socket.onmessage = (message) => { try { onEventRef.current(JSON.parse(message.data)); } catch { /* discard malformed frames */ } };
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) { const delay = Math.min(30_000, 1_000 * 2 ** attempts.current++); reconnect = window.setTimeout(connect, delay); }
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => { disposed = true; if (reconnect) clearTimeout(reconnect); socketRef.current?.close(); socketRef.current = null; };
  }, [path]);
  const send = useCallback((event: Record<string, unknown>) => { if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify(event)); }, []);
  return { connected, send };
}
