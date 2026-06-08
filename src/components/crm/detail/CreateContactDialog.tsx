"use client";

// 連絡先の手動追加 Dialog。ContactService/CreateContact を呼ぶ。
// phone / mail / fax は proto 側で「指定時のみ」バリデーションされる optional 値なので、
// 空欄のまま送ると min_len / email 検証に引っかかる。空欄はキーごと省略する。

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

interface CreateContactDialogProps {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

export function CreateContactDialog({
  customerId,
  open,
  onOpenChange,
  onCreated,
}: CreateContactDialogProps) {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [form, setForm] = useState({ name: "", sex: "", phone: "", mail: "", fax: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm({ name: "", sex: "", phone: "", mail: "", fax: "" });
      setIsSubmitting(false);
      setError(null);
    }
  }, [open]);

  const trimmedName = form.name.trim();
  const canSubmit = trimmedName.length > 0 && !isSubmitting;

  const updateField =
    (field: "name" | "phone" | "mail" | "fax") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = async () => {
    if (!canSubmit || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        customer_id: customerId,
        name: trimmedName,
        sex: form.sex,
      };
      // 空欄の optional 値は送らない (proto validation 回避)
      const phone = form.phone.trim();
      const mail = form.mail.trim();
      const fax = form.fax.trim();
      if (phone) body.phone = phone;
      if (mail) body.mail = mail;
      if (fax) body.fax = fax;

      const response = await fetch(`${API_URL}/contact.v1.ContactService/CreateContact`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 403 || text.includes("permission_denied")) {
          throw new Error("この顧客に連絡先を追加する権限がありません");
        }
        throw new Error(text || `HTTP ${response.status}`);
      }

      onCreated();
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`作成に失敗しました: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>連絡先を追加</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div className="space-y-1">
            <label htmlFor="create-contact-name" className="text-sm font-medium text-gray-700">
              担当者名 <span className="text-red-600">*</span>
            </label>
            <Input
              id="create-contact-name"
              value={form.name}
              onChange={updateField("name")}
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">性別</label>
            <Select
              value={form.sex || undefined}
              onValueChange={(v) => setForm((prev) => ({ ...prev, sex: v }))}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="未設定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="男">男</SelectItem>
                <SelectItem value="女">女</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="create-contact-phone" className="text-sm font-medium text-gray-700">
                電話番号
              </label>
              <Input
                id="create-contact-phone"
                value={form.phone}
                onChange={updateField("phone")}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="create-contact-fax" className="text-sm font-medium text-gray-700">
                FAX
              </label>
              <Input
                id="create-contact-fax"
                value={form.fax}
                onChange={updateField("fax")}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="create-contact-mail" className="text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <Input
              id="create-contact-mail"
              type="email"
              value={form.mail}
              onChange={updateField("mail")}
              disabled={isSubmitting}
              placeholder="例: contact@example.com"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "作成中..." : "作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
