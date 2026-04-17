"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { FiPhone, FiEdit2, FiCheck, FiX } from "react-icons/fi";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

interface PhoneInputProps {
  value: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  readOnly?: boolean;
  className?: string;
  showIcon?: boolean;
  placeholder?: string;
  customerId?: string;
  bookId?: string;
  onCallCreated?: () => void;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  readOnly = false,
  className,
  showIcon = true,
  placeholder = "電話番号",
  customerId,
  bookId,
  onCallCreated,
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

  // 電話番号をZoom Phone発信用にフォーマット（ハイフンや空白を除去）
  const formatPhoneForTel = (phone: string) => {
    return phone.replace(/[-\s]/g, "");
  };

  const user = useAuthStore((state) => state.user);

  // Phase 21: Zoom Phone API 経由で発信 + Activity 記録。
  // Zoom API が未設定 (dev/MailHog 環境) なら従来の zoomphonecall: URL scheme にフォールバック。
  const handlePhoneClick = async (e: React.MouseEvent, phone: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user || !phone) return;

    const token = user.accessToken;
    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';

    // 1. まず Zoom Phone API 発信を試行
    try {
      const resp = await fetch(`${apiUrl}/zoomphone.v1.ZoomPhoneService/MakeCall`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phone,
          customer_id: customerId || '',
        }),
      });

      if (resp.ok) {
        // Zoom API 発信成功 — Activity も backend 側で記録済み
        console.log('Zoom Phone API: 発信成功');
        onCallCreated?.();
        return;
      }

      // 503 (Zoom 未設定) or 404 (Zoom ユーザー未紐付) → フォールバック
      const errText = await resp.text();
      console.warn('Zoom Phone API 発信失敗、フォールバック:', errText);
    } catch (err) {
      console.warn('Zoom Phone API エラー、フォールバック:', err);
    }

    // 2. フォールバック: 従来の Activity 記録 + zoomphonecall: URL scheme
    await saveCallHistoryLegacy(phone);
    const formattedPhone = formatPhoneForTel(phone);
    const link = document.createElement('a');
    link.href = `zoomphonecall:${formattedPhone}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 旧方式の Activity 記録 (Zoom API 未設定時のフォールバック)
  const saveCallHistoryLegacy = async (phone: string) => {
    if (!user || !customerId || !bookId) return;
    try {
      const token = user.accessToken;
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';

      const statusResponse = await fetch(`${apiUrl}/status.v1.StatusService/GetDefaultStatus`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ book_id: bookId }),
      });
      if (!statusResponse.ok) {
        console.error('デフォルトステータスの取得に失敗しました');
        return;
      }
      const statusData = await statusResponse.json();
      const defaultStatusId = statusData.status?.id;
      if (!defaultStatusId) return;

      const callResponse = await fetch(`${apiUrl}/activity.v1.ActivityService/CreateActivityCall`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customerId,
          phone: phone,
          status_id: defaultStatusId,
        }),
      });
      if (callResponse.ok) onCallCreated?.();
    } catch (error) {
      console.error('架電履歴の保存中にエラー:', error);
    }
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
        <button
          type="button"
          onClick={(e) => handlePhoneClick(e, value)}
          className="flex-1 text-left text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors cursor-pointer"
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
  customerId?: string;
  bookId?: string;
  onCallCreated?: () => void;
}

export function PhoneLink({ phone, className, customerId, bookId, onCallCreated }: PhoneLinkProps) {
  const user = useAuthStore((state) => state.user);

  if (!phone) {
    return <span className="text-gray-400">-</span>;
  }

  const formatPhoneForTel = (phone: string) => {
    return phone.replace(/[-\s]/g, "");
  };

  // Phase 21: Zoom Phone API or legacy fallback (PhoneInput と同じロジック)
  const handlePhoneClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !phone) return;

    const token = user.accessToken;
    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';

    try {
      const resp = await fetch(`${apiUrl}/zoomphone.v1.ZoomPhoneService/MakeCall`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phone,
          customer_id: customerId || '',
        }),
      });
      if (resp.ok) {
        onCallCreated?.();
        return;
      }
    } catch { /* fallback */ }

    // Fallback: legacy Activity 記録 + zoomphonecall: URL
    if (customerId && bookId) {
      try {
        const statusResp = await fetch(`${apiUrl}/status.v1.StatusService/GetDefaultStatus`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ book_id: bookId }),
        });
        if (statusResp.ok) {
          const statusData = await statusResp.json();
          const sid = statusData.status?.id;
          if (sid) {
            const callResp = await fetch(`${apiUrl}/activity.v1.ActivityService/CreateActivityCall`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ customer_id: customerId, phone, status_id: sid }),
            });
            if (callResp.ok) onCallCreated?.();
          }
        }
      } catch { /* ignore */ }
    }
    const formattedPhone = formatPhoneForTel(phone);
    const link = document.createElement('a');
    link.href = `zoomphonecall:${formattedPhone}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      type="button"
      onClick={handlePhoneClick}
      className={cn(
        "text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors inline-flex items-center gap-1 cursor-pointer",
        className
      )}
    >
      <FiPhone className="w-3 h-3" />
      {phone}
    </button>
  );
}
