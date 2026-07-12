import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../stores/auth";
import type { CarrierWebsheetInfo } from "../types/api";
import { Modal } from "./ui";

export function CarrierWebsheet({
  websheet,
  onClose,
  onDone,
}: {
  websheet: CarrierWebsheetInfo;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const completing = useRef(false);
  const token = useMemo(() => {
    try {
      return new URL(websheet.embedUrl, window.location.origin).searchParams.get("token") || "";
    } catch {
      return "";
    }
  }, [websheet.embedUrl]);

  useEffect(() => {
    const isCurrentMessage = (data: unknown): data is { type: string; token?: string; callback?: unknown } => {
      if (!data || typeof data !== "object") return false;
      const message = data as { type?: unknown; token?: unknown };
      if (message.type !== "vohive-websheet-callback") return false;
      return !(token && typeof message.token === "string" && message.token !== token);
    };
    const isTerminal = (callback: unknown) => {
      if (!callback || typeof callback !== "object") return true;
      const value = String(
        (callback as { event?: unknown; method?: unknown; resultCode?: unknown }).event ??
          (callback as { method?: unknown }).method ??
          (callback as { resultCode?: unknown }).resultCode ??
          "",
      ).toLowerCase();
      return !value || !value.includes("phoneservicesaccountstatuschanged");
    };
    const complete = async () => {
      if (completing.current) return;
      completing.current = true;
      try {
        await api.post(`/websheets/${websheet.id}/done`);
      } catch {
        // Carrier callbacks are best-effort; the final device refresh is authoritative.
      } finally {
        onDone();
      }
    };
    const handle = (data: unknown) => {
      if (!isCurrentMessage(data)) return;
      if (isTerminal(data.callback)) void complete();
      else void api.post(`/websheets/${websheet.id}/callback`, data.callback).catch(() => undefined);
    };
    const messageListener = (event: MessageEvent) => handle(event.data);
    const storageListener = (event: StorageEvent) => {
      if (event.key !== "vohive-websheet-complete" || !event.newValue) return;
      try {
        handle(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed or stale cross-window notifications.
      }
    };
    window.addEventListener("message", messageListener);
    window.addEventListener("storage", storageListener);
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel("vohive-websheet");
      channel.onmessage = (event) => handle(event.data);
    } catch {
      channel = undefined;
    }
    return () => {
      window.removeEventListener("message", messageListener);
      window.removeEventListener("storage", storageListener);
      channel?.close();
    };
  }, [onDone, token, websheet.id]);

  return (
    <Modal title={websheet.title || "E911 地址"} onClose={onClose}>
      <div className="websheet-frame-shell">
        {!loaded && <div className="websheet-loading">加载中…</div>}
        <iframe
          src={websheet.embedUrl}
          title={websheet.title || "E911 地址"}
          sandbox="allow-forms allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </Modal>
  );
}
