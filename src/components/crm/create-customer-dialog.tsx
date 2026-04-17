"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";

interface Customer {
  id: string;
  bookId: string;
  phone: string;
  category: string;
  name: string;
  corporation: string;
  address: string;
  memo: string;
  mail: string;
}

interface CreateCustomerDialogProps {
  bookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: Customer) => void;
}

export function CreateCustomerDialog({ bookId, open, onOpenChange, onCreated }: CreateCustomerDialogProps) {
  const [form, setForm] = useState({
    phone: "",
    category: "",
    name: "",
    corporation: "",
    address: "",
    memo: "",
    mail: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessToken = useAuthStore((s) => s.user?.accessToken);

  useEffect(() => {
    if (!open) {
      setForm({ phone: "", category: "", name: "", corporation: "", address: "", memo: "", mail: "" });
      setIsSubmitting(false);
      setError(null);
    }
  }, [open]);

  const trimmedName = form.name.trim();
  const canSubmit = trimmedName.length > 0 && !isSubmitting;

  const updateField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
      const response = await fetch(`${apiUrl}/customer.v1.CustomerService/CreateCustomer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          book_id: bookId,
          phone: form.phone.trim(),
          category: form.category.trim(),
          name: trimmedName,
          corporation: form.corporation.trim(),
          address: form.address.trim(),
          memo: form.memo.trim(),
          mail: form.mail.trim(),
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        if (response.status === 403 || text.includes("permission_denied")) {
          throw new Error("この Book に書き込む権限がありません");
        }
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const c = data.customer || {};
      onCreated({
        id: c.id || "",
        bookId: c.book_id || c.bookId || bookId,
        phone: c.phone || "",
        category: c.category || "",
        name: c.name || "",
        corporation: c.corporation || "",
        address: c.address || "",
        memo: c.memo || "",
        mail: c.mail || "",
      });
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
          <DialogTitle>顧客を追加</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div className="space-y-1">
            <label htmlFor="create-customer-name" className="text-sm font-medium text-gray-700">
              顧客名 <span className="text-red-600">*</span>
            </label>
            <Input
              id="create-customer-name"
              value={form.name}
              onChange={updateField("name")}
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="create-customer-corporation" className="text-sm font-medium text-gray-700">
              法人名
            </label>
            <Input
              id="create-customer-corporation"
              value={form.corporation}
              onChange={updateField("corporation")}
              disabled={isSubmitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="create-customer-phone" className="text-sm font-medium text-gray-700">
                電話番号
              </label>
              <Input
                id="create-customer-phone"
                value={form.phone}
                onChange={updateField("phone")}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="create-customer-category" className="text-sm font-medium text-gray-700">
                カテゴリ
              </label>
              <Input
                id="create-customer-category"
                value={form.category}
                onChange={updateField("category")}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="create-customer-address" className="text-sm font-medium text-gray-700">
              住所
            </label>
            <Input
              id="create-customer-address"
              value={form.address}
              onChange={updateField("address")}
              disabled={isSubmitting}
              placeholder="例: 東京都渋谷区1-2-3"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="create-customer-mail" className="text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <Input
              id="create-customer-mail"
              type="email"
              value={form.mail}
              onChange={updateField("mail")}
              disabled={isSubmitting}
              placeholder="例: customer@example.com"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="create-customer-memo" className="text-sm font-medium text-gray-700">
              メモ
            </label>
            <Input
              id="create-customer-memo"
              value={form.memo}
              onChange={updateField("memo")}
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
            {isSubmitting ? "作成中..." : "作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
