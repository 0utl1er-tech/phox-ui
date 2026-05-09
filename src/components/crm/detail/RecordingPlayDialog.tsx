"use client";

// RecordingPlayDialog は ActivityHistoryCard の call 行で再生アイコンを
// クリックされた時にモーダルで開く。`open=true` になった瞬間に
// GetActivityRecording RPC を叩き、返ってきた短命 signed URL を <audio>
// にバインドする。URL は 5 分の TTL なので、開いてすぐ再生する想定なら
// expires_at までの再取得は不要。ダイアログを閉じると state は破棄される。

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { FiPhone, FiAlertTriangle } from "react-icons/fi";

interface RecordingPlayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string | null;
  accessToken: string | null | undefined;
  occurredAt: string;
  durationSeconds?: number;
  customerName?: string;
}

function formatDuration(s: number | undefined): string | null {
  if (typeof s !== "number" || !Number.isFinite(s) || s <= 0) return null;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function RecordingPlayDialog({
  open,
  onOpenChange,
  activityId,
  accessToken,
  occurredAt,
  durationSeconds,
  customerName,
}: RecordingPlayDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 開いた時だけ fetch。閉じる時に reset。
    if (!open || !activityId || !accessToken) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);

    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
    fetch(`${apiUrl}/activity.v1.ActivityService/GetActivityRecording`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: activityId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text || res.statusText}`);
        }
        return res.json();
      })
      .then((j) => {
        if (cancelled) return;
        if (!j.url) throw new Error("empty url in response");
        setUrl(j.url as string);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, activityId, accessToken]);

  // ダイアログ閉じる時に再生も止める。
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
    }
  }, [open]);

  const dur = formatDuration(durationSeconds);
  const occurredFmt = (() => {
    const d = new Date(occurredAt);
    if (Number.isNaN(d.getTime())) return occurredAt;
    return d.toLocaleString("ja-JP");
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FiPhone className="w-4 h-4" />
            通話録音の再生
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-gray-600 space-y-1">
            {customerName && (
              <div>
                <span className="text-gray-400">顧客:</span> {customerName}
              </div>
            )}
            <div>
              <span className="text-gray-400">通話日時:</span> {occurredFmt}
            </div>
            {dur && (
              <div>
                <span className="text-gray-400">通話時間:</span> {dur}
              </div>
            )}
          </div>

          {loading && <div className="text-sm text-gray-500">録音 URL を取得中…</div>}

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-2 rounded">
              <FiAlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">録音を取得できませんでした</div>
                <div className="text-xs text-red-600">{error}</div>
              </div>
            </div>
          )}

          {url && (
            <audio
              ref={audioRef}
              src={url}
              controls
              autoPlay
              className="w-full"
              data-testid="recording-audio"
            />
          )}

          <div className="flex justify-end pt-2">
            <DialogClose
              onClose={() => onOpenChange(false)}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1"
            >
              閉じる
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
