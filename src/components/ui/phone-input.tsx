"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FiPhone, FiEdit2, FiCheck, FiX } from "react-icons/fi";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  readOnly?: boolean;
  className?: string;
  showIcon?: boolean;
  placeholder?: string;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  readOnly = false,
  className,
  showIcon = true,
  placeholder = "電話番号",
}: PhoneInputProps) {
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

  // 電話番号をtel:リンク用にフォーマット（ハイフンや空白を除去）
  const formatPhoneForTel = (phone: string) => {
    return phone.replace(/[-\s]/g, "");
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Input
          ref={inputRef}
          type="tel"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="flex-1"
          placeholder={placeholder}
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
        className
      )}
    >
      {showIcon && <FiPhone className="w-4 h-4 text-gray-500 flex-shrink-0" />}
      {value ? (
        <a
          href={`tel:${formatPhoneForTel(value)}`}
          className="flex-1 text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ) : (
        <span className="flex-1 text-gray-400">{placeholder || "-"}</span>
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={handleEditClick}
          className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all"
          title="編集"
        >
          <FiEdit2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// テーブルセル用のシンプルな電話番号リンク
interface PhoneLinkProps {
  phone: string;
  className?: string;
}

export function PhoneLink({ phone, className }: PhoneLinkProps) {
  if (!phone) {
    return <span className="text-gray-400">-</span>;
  }

  const formatPhoneForTel = (phone: string) => {
    return phone.replace(/[-\s]/g, "");
  };

  return (
    <a
      href={`tel:${formatPhoneForTel(phone)}`}
      className={cn(
        "text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors inline-flex items-center gap-1",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <FiPhone className="w-3 h-3" />
      {phone}
    </a>
  );
}
