"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";

interface Book {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

interface CreateBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (book: Book) => void;
}

export function CreateBookDialog({ open, onOpenChange, onCreated }: CreateBookDialogProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessToken = useAuthStore((s) => s.user?.accessToken);

  // Dialog を閉じるたびに state をリセット
  useEffect(() => {
    if (!open) {
      setName("");
      setIsSubmitting(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !accessToken) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
      const response = await fetch(`${apiUrl}/book.v1.BookService/CreateBook`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = await response.json();
      onCreated(data.book);
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`作成に失敗しました: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>新しいリストを作成</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="create-book-name" className="text-sm font-medium text-gray-700">
              リスト名
            </label>
            <Input
              id="create-book-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 4月のアウトバウンド"
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
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
