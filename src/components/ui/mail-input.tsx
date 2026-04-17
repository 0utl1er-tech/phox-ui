"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FiMail, FiEdit2, FiCheck, FiX } from "react-icons/fi";
import { cn } from "@/lib/utils";

interface MailInputProps {
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  /** メールアイコンまたは表示値のクリック時に呼ばれる (SendEmailDialog を開く想定)。 */
  onOpenSendDialog?: () => void;
}

/**
 * PhoneInput と対になる代表メール入力 + 送信ダイアログ起動ボタン。
 *
 * - 表示モードでは FiMail アイコンと値ボタンの両方が `onOpenSendDialog` を呼ぶ。
 *   (PhoneInput が電話アイコン + 値ボタンで Zoom 発信するのとシンメトリ)
 * - 編集モードでは Enter/blur で保存、Escape でキャンセル。
 */
export function MailInput({
  value,
  onChange,
  onBlur,
  readOnly = false,
  className,
  placeholder = "メールアドレス",
  onOpenSendDialog,
}: MailInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) {
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    if (onChange && editValue !== value) {
      onChange(editValue);
    }
    onBlur?.();
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const handleOpenSendDialog = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenSendDialog?.();
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Input
          ref={inputRef}
          type="email"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="flex-1"
          placeholder={placeholder}
          data-testid="representative-mail-input"
        />
        <button
          type="button"
          onClick={handleSave}
          className="p-1.5 rounded-full hover:bg-green-100 text-green-600 transition-colors"
        >
          <FiCheck className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="p-1.5 rounded-full hover:bg-red-100 text-red-600 transition-colors"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-md border bg-white group",
        !readOnly && "hover:border-blue-300",
        className,
      )}
    >
      <button
        type="button"
        onClick={handleOpenSendDialog}
        disabled={!value || !onOpenSendDialog}
        aria-label="メール送信を開く"
        className="flex-shrink-0 text-gray-500 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
        title="メール送信"
      >
        <FiMail className="w-4 h-4" />
      </button>
      {value ? (
        <button
          type="button"
          onClick={handleOpenSendDialog}
          disabled={!onOpenSendDialog}
          data-testid="representative-mail-value"
          className="flex-1 text-left text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors cursor-pointer disabled:text-blue-600 disabled:no-underline disabled:cursor-default"
        >
          {value}
        </button>
      ) : (
        <span className="flex-1 text-gray-400">{placeholder || "-"}</span>
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={handleEditClick}
          aria-label="代表メールを編集"
          className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all"
          title="編集"
        >
          <FiEdit2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
