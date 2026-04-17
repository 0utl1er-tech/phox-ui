"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { FiMail, FiArrowRight, FiArrowLeft, FiClock, FiUser } from "react-icons/fi";

interface EmailDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: {
    type: "email_sent" | "email_received";
    subject?: string;
    body?: string;
    mailFrom?: string;
    mailTo?: string;
    mailCc?: string;
    userName: string;
    occurredAt: string;
  } | null;
}

export function EmailDetailDialog({ open, onOpenChange, email }: EmailDetailDialogProps) {
  if (!email) return null;

  const isSent = email.type === "email_sent";
  const dateStr = email.occurredAt
    ? new Date(email.occurredAt).toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {isSent ? (
              <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                <FiArrowRight className="w-3 h-3" />
                送信
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                <FiArrowLeft className="w-3 h-3" />
                受信
              </span>
            )}
            <span className="truncate">{email.subject || "(件名なし)"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* ヘッダ情報 */}
          <div className="space-y-2 text-sm border-b pb-4">
            <div className="flex items-center gap-2">
              <FiMail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500 w-12 flex-shrink-0">From:</span>
              <span className="font-medium text-gray-900">{email.mailFrom || "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500 w-12 flex-shrink-0">To:</span>
              <span className="font-medium text-gray-900">{email.mailTo || "-"}</span>
            </div>
            {email.mailCc && (
              <div className="flex items-center gap-2">
                <FiArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 w-12 flex-shrink-0">CC:</span>
                <span className="text-gray-700">{email.mailCc}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <FiClock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500 w-12 flex-shrink-0">日時:</span>
              <span className="text-gray-700">{dateStr}</span>
            </div>
            <div className="flex items-center gap-2">
              <FiUser className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500 w-12 flex-shrink-0">担当:</span>
              <span className="text-gray-700">{email.userName || "-"}</span>
            </div>
          </div>

          {/* 本文 */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">本文</p>
            {email.body ? (
              <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 bg-gray-50 rounded-lg p-4 font-sans leading-relaxed">
                {email.body}
              </pre>
            ) : (
              <p className="text-sm text-gray-400 italic">本文なし</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
