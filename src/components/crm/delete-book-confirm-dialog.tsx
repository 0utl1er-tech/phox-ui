"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";

interface DeleteBookConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: { id: string; name: string } | null;
  onDeleted: (bookId: string) => void;
}

export function DeleteBookConfirmDialog({ open, onOpenChange, book, onDeleted }: DeleteBookConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessToken = useAuthStore((s) => s.user?.accessToken);

  useEffect(() => {
    if (!open) {
      setIsSubmitting(false);
      setError(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!book || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
      const response = await fetch(`${apiUrl}/book.v1.BookService/DeleteBook`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: book.id }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      onDeleted(book.id);
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`削除に失敗しました: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>リストを削除</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">{book?.name ?? ""}</span> を削除しますか?
            この操作は取り消せません。
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !book}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isSubmitting ? "削除中..." : "削除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
