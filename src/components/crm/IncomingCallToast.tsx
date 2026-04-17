"use client";

import { useState, useCallback } from "react";
import { useZoomCallNotifications, type CallNotification } from "@/hooks/useZoomCallNotifications";
import { FiPhone, FiX } from "react-icons/fi";

/**
 * 着信トースト — Navbar の下に固定表示。
 * Zoom Webhook → SSE → この UI に着信情報がリアルタイムで表示される。
 * 通話終了 or 手動閉じで消える。
 */
export function IncomingCallToast() {
  const [activeCall, setActiveCall] = useState<CallNotification | null>(null);

  const handleRinging = useCallback((n: CallNotification) => {
    // inbound のみ表示 (自分が発信した outbound は表示しない)
    if (n.direction === "inbound") {
      setActiveCall(n);
    }
  }, []);

  const handleEnded = useCallback((n: CallNotification) => {
    setActiveCall((prev) => {
      if (prev && prev.call_id === n.call_id) return null;
      return prev;
    });
  }, []);

  useZoomCallNotifications({
    onRinging: handleRinging,
    onEnded: handleEnded,
  });

  if (!activeCall) return null;

  const displayName = activeCall.customer_name || activeCall.caller_name || "不明";
  const displayNumber = activeCall.caller_number || "-";

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className="bg-green-600 text-white rounded-lg shadow-2xl px-6 py-4 flex items-center gap-4 min-w-[320px]">
        <div className="bg-white/20 rounded-full p-2 animate-pulse">
          <FiPhone className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-lg">{displayName}</p>
          <p className="text-green-100 text-sm">{displayNumber}</p>
          <p className="text-green-200 text-xs mt-0.5">着信中...</p>
        </div>
        {activeCall.customer_id && (
          <a
            href={`/customer/${activeCall.customer_id}`}
            className="bg-white/20 hover:bg-white/30 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          >
            顧客を開く
          </a>
        )}
        <button
          type="button"
          onClick={() => setActiveCall(null)}
          className="p-1 hover:bg-white/20 rounded-full transition-colors"
          aria-label="閉じる"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
