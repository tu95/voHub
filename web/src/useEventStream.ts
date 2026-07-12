import { useEffect, useRef, useState } from "react";
import { api, authStore } from "./stores/auth";

type EventStreamOptions<T> = {
  path: string;
  eventName: string;
  enabled?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
  parse?: (payload: string) => T;
  onEvent: (data: T) => void;
  onRawEvent?: (eventName: string, payload: string) => void;
  reconnectDelayMs?: number;
};

export function useEventStream<T>(options: EventStreamOptions<T>) {
  const callbacks = useRef(options);
  callbacks.current = options;
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState("");
  const queryKey = JSON.stringify(options.query || {});

  useEffect(() => {
    if (options.enabled === false || !options.path) return;
    let disposed = false;
    let reconnectTimer: number | undefined;
    let controller: AbortController | undefined;

    const connect = async () => {
      controller?.abort();
      controller = new AbortController();
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(callbacks.current.query || {})) {
        if (value !== undefined && value !== "") query.set(key, String(value));
      }
      const suffix = query.toString();
      const url = `${api.defaults.baseURL || ""}${callbacks.current.path}${suffix ? `?${suffix}` : ""}`;

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${authStore.getToken()}`,
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("事件流响应为空");
        setConnected(true);
        setLastError("");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventName = "";
        let dataLines: string[] = [];
        while (!disposed) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline >= 0) {
            let line = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line) {
              const payload = dataLines.join("\n");
              if (eventName === callbacks.current.eventName) {
                const parse = callbacks.current.parse || JSON.parse;
                callbacks.current.onEvent(parse(payload) as T);
              }
              if (eventName) callbacks.current.onRawEvent?.(eventName, payload);
              eventName = "";
              dataLines = [];
            } else if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trimStart());
            }
            newline = buffer.indexOf("\n");
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLastError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        setConnected(false);
        if (!disposed) {
          reconnectTimer = window.setTimeout(
            () => void connect(),
            callbacks.current.reconnectDelayMs ?? 5000,
          );
        }
      }
    };

    void connect();
    return () => {
      disposed = true;
      controller?.abort();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      setConnected(false);
    };
  }, [options.path, options.enabled, queryKey]);

  return { connected, lastError };
}
