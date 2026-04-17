"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";

export interface CallNotification {
  type: "ringing" | "answered" | "ended";
  call_id: string;
  caller_number: string;
  caller_name: string;
  customer_id: string;
  customer_name: string;
  direction: string;
  timestamp: string;
}

/**
 * Zoom Phone 着信通知を SSE で購読し、コールバックを呼ぶ hook。
 *
 * - backend の `GET /sse/calls?email={user email}` に SSE 接続
 * - 着信 (type=ringing) 時に onRinging を呼ぶ
 * - 通話終了 (type=ended) 時に onEnded を呼ぶ
 * - ブラウザの Push Notification 許可があればそちらにも通知
 *
 * コンポーネントの unmount で SSE 接続は自動切断される。
 */
export function useZoomCallNotifications(opts: {
  onRinging?: (n: CallNotification) => void;
  onEnded?: (n: CallNotification) => void;
}) {
  const email = useAuthStore((s) => s.user?.email);
  const eventSourceRef = useRef<EventSource | null>(null);

  const onRingingRef = useRef(opts.onRinging);
  const onEndedRef = useRef(opts.onEnded);
  onRingingRef.current = opts.onRinging;
  onEndedRef.current = opts.onEnded;

  // ブラウザ通知の許可をリクエスト (初回のみ)
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  const showBrowserNotification = useCallback((n: CallNotification) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const title = n.customer_name
      ? `${n.customer_name} からの着信`
      : `${n.caller_number} からの着信`;
    const body = n.caller_name
      ? `${n.caller_name} (${n.caller_number})`
      : n.caller_number;

    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: n.call_id, // 同じ call の重複通知を防ぐ
    });
  }, []);

  useEffect(() => {
    if (!email) return;

    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
    const url = `${apiUrl}/sse/calls?email=${encodeURIComponent(email)}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("call", (event) => {
      try {
        const n: CallNotification = JSON.parse(event.data);
        if (n.type === "ringing") {
          onRingingRef.current?.(n);
          showBrowserNotification(n);
        } else if (n.type === "ended") {
          onEndedRef.current?.(n);
        }
      } catch (e) {
        console.warn("SSE parse error:", e);
      }
    });

    es.onerror = () => {
      // SSE auto-reconnects — just log
      console.debug("SSE connection error (will auto-reconnect)");
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [email, showBrowserNotification]);
}
