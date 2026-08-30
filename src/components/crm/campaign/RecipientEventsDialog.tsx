"use client";

// Phase 27b: 受信者ごとの開封・クリックなどイベント履歴ダイアログ。
// ListRecipientEvents を開いたときに取得して時系列表示する。

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { RecipientStatusBadge } from "@/components/crm/campaign/StatusBadge";
import {
  type CampaignRecipient,
  type CampaignRecipientEvent,
  normalizeCampaignEvent,
  parseConnectError,
  formatTimestamp,
} from "@/lib/campaign";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

const EVENT_KIND_STYLES: Record<string, { label: string; className: string }> = {
  open: { label: "開封", className: "bg-blue-100 text-blue-800" },
  click: { label: "クリック", className: "bg-green-100 text-green-800" },
  unsubscribe: { label: "配信停止", className: "bg-red-100 text-red-800" },
  reply: { label: "返信", className: "bg-purple-100 text-purple-800" },
  bounce: { label: "バウンス", className: "bg-orange-100 text-orange-800" },
};

function EventKindBadge({ kind }: { kind: string }) {
  const style = EVENT_KIND_STYLES[kind] ?? {
    label: kind || "-",
    className: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${style.className}`}
    >
      {style.label}
    </span>
  );
}

interface RecipientEventsDialogProps {
  recipient: CampaignRecipient | null;
  accessToken?: string;
  onClose: () => void;
}

export function RecipientEventsDialog({
  recipient,
  accessToken,
  onClose,
}: RecipientEventsDialogProps) {
  const [events, setEvents] = useState<CampaignRecipientEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipientId = recipient?.id;

  useEffect(() => {
    if (!recipientId || !accessToken) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setEvents([]);
      try {
        const response = await fetch(
          `${API_URL}/campaign.v1.CampaignService/ListRecipientEvents`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ recipientId }),
          },
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(parseConnectError(text, response.status));
        }
        const data = await response.json();
        if (cancelled) return;
        setEvents((data.events ?? []).map((e: any) => normalizeCampaignEvent(e)));
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "unknown error";
        setError(`イベントの取得に失敗しました: ${message}`);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [recipientId, accessToken]);

  return (
    <Dialog open={!!recipient} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {recipient && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {recipient.customerName || "(名前なし)"}
                <RecipientStatusBadge status={recipient.status} />
              </DialogTitle>
              <DialogDescription>{recipient.email || "-"}</DialogDescription>
              <DialogClose onClose={onClose} />
            </DialogHeader>
            <div className="px-6 py-4 overflow-y-auto">
              {isLoading ? (
                <p className="text-sm text-gray-500 py-6 text-center">読み込み中...</p>
              ) : error ? (
                <p className="text-sm text-red-600 py-4">{error}</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  イベントはまだありません
                </p>
              ) : (
                <ul className="space-y-3">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-start gap-3">
                      <EventKindBadge kind={event.kind} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-700 tabular-nums">
                          {formatTimestamp(event.createdAt)}
                        </p>
                        {event.url && (
                          <p
                            className="text-sm text-blue-600 truncate"
                            title={event.url}
                          >
                            {event.url}
                          </p>
                        )}
                        {event.userAgent && (
                          <p className="text-xs text-gray-400 truncate" title={event.userAgent}>
                            {event.userAgent}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
