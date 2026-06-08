"use client";

// コール活動の手動追加 Dialog。ActivityService/CreateActivityCall を呼ぶ。
// 通常は電話発信時に自動記録されるが、システム外でかけた通話を後から手入力するための導線。
// occurred_at は過去日時も指定可能 (初期値は現在時刻)。

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";

interface StatusOption {
  id: string;
  name: string;
}

interface CreateActivityCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerPhone?: string;
  statuses: StatusOption[];
  onCreated: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

// datetime-local input ("YYYY-MM-DDTHH:mm", ローカル TZ) との相互変換。
function nowLocalInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function localInputToIso(v: string): string {
  if (!v) return "";
  return new Date(v).toISOString();
}

export function CreateActivityCallDialog({
  open,
  onOpenChange,
  customerId,
  customerPhone,
  statuses,
  onCreated,
}: CreateActivityCallDialogProps) {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [phone, setPhone] = useState("");
  const [statusId, setStatusId] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhone(customerPhone ?? "");
      setStatusId(statuses[0]?.id ?? "");
      setOccurredAt(nowLocalInput());
      setIsSubmitting(false);
      setError(null);
    }
  }, [open, customerPhone, statuses]);

  const canSubmit = phone.trim().length > 0 && statusId !== "" && occurredAt !== "" && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/activity.v1.ActivityService/CreateActivityCall`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId,
          phone: phone.trim(),
          status_id: statusId,
          occurred_at: localInputToIso(occurredAt),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 403 || text.includes("permission_denied")) {
          throw new Error("この顧客に活動を追加する権限がありません");
        }
        throw new Error(text || `HTTP ${response.status}`);
      }

      onCreated();
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`追加に失敗しました: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>コール履歴を追加</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="create-call-phone" className="text-sm font-medium text-gray-700">
              電話番号 <span className="text-red-600">*</span>
            </label>
            <Input
              id="create-call-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              ステータス <span className="text-red-600">*</span>
            </label>
            <Select value={statusId || undefined} onValueChange={setStatusId} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="ステータスを選択" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="create-call-occurred" className="text-sm font-medium text-gray-700">
              日時 <span className="text-red-600">*</span>
            </label>
            <Input
              id="create-call-occurred"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "追加中..." : "追加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
