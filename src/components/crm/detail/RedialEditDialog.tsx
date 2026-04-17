"use client";

// Phase 20c: 掛け直し予定の編集 Dialog (新規作成 / 編集共通)。
// Phase 20 当初は RedialCard 内に閉じていたが、ActivityHistoryCard に統合した
// 関係でここに単離した。ActivityHistoryCard から import して使う。

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/authStore";

export type RedialSyncStatus = "synced" | "unsynced" | "not_connected" | "unspecified";

export interface RedialDraft {
  id: string;
  customerId: string;
  phone: string;
  startAt: string; // ISO 文字列
  endAt: string;
  note: string;
}

interface RedialEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: RedialDraft | null;
  onSaved: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

/**
 * datetime-local input は "YYYY-MM-DDTHH:mm" 形式 (ローカル TZ)。ISO から変換。
 */
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function localInputToIso(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  return d.toISOString();
}

export function RedialEditDialog({ open, onOpenChange, initial, onSaved }: RedialEditDialogProps) {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [phone, setPhone] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhone(initial?.phone ?? "");
      setStartAt(isoToLocalInput(initial?.startAt ?? ""));
      setEndAt(isoToLocalInput(initial?.endAt ?? ""));
      setNote(initial?.note ?? "");
      setError(null);
    }
  }, [open, initial]);

  const isNew = !initial?.id;

  const handleSave = async () => {
    if (!accessToken) return;
    if (!startAt || !endAt) {
      setError("開始時刻と終了時刻は必須です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        phone,
        start_at: localInputToIso(startAt),
        end_at: localInputToIso(endAt),
        note,
      };
      if (isNew) {
        const res = await fetch(`${API_URL}/redial.v1.RedialService/CreateRedial`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer_id: initial?.customerId, ...payload }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(`${API_URL}/redial.v1.RedialService/UpdateRedial`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: initial?.id, ...payload }),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{isNew ? "新規掛け直し予約" : "掛け直し予定を編集"}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="redial-phone" className="text-sm font-medium text-gray-700">
              電話番号
            </label>
            <Input
              id="redial-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="redial-start" className="text-sm font-medium text-gray-700">
                開始 <span className="text-red-600">*</span>
              </label>
              <Input
                id="redial-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="redial-end" className="text-sm font-medium text-gray-700">
                終了 <span className="text-red-600">*</span>
              </label>
              <Input
                id="redial-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="redial-note" className="text-sm font-medium text-gray-700">
              メモ
            </label>
            <Textarea
              id="redial-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              disabled={saving}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
