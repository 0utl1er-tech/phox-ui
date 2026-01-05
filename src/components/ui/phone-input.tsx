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

  // 架電履歴を自動保存
  const saveCallHistory = async (phone: string) => {
    console.log('saveCallHistory called:', { user: !!user, customerId, bookId, phone });
    if (!user || !customerId || !bookId) {
      console.log('saveCallHistory: 必要な情報が不足しています', { user: !!user, customerId, bookId });
      return;
    }

    try {
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';

      // デフォルトステータス（priorityが最小のもの）を取得
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

      if (!defaultStatusId) {
        console.error('デフォルトステータスが見つかりません');
        return;
      }

      // 架電履歴を保存
      const callResponse = await fetch(`${apiUrl}/call.v1.CallService/CreateCall`, {
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

      if (!callResponse.ok) {
        console.error('架電履歴の保存に失敗しました');
        return;
      }

      // 架電履歴の保存成功時にコールバックを呼び出し
      onCallCreated?.();
    } catch (error) {
      console.error('架電履歴の保存中にエラーが発生しました:', error);
    }
  };

  // Zoom Phoneで直接発信
  const handlePhoneClick = async (e: React.MouseEvent, phone: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 架電履歴を先に保存
    await saveCallHistory(phone);
    
    const formattedPhone = formatPhoneForTel(phone);
    
    // Zoom Phoneを起動（aタグを動的に作成してページ遷移を防ぐ）
    const link = document.createElement('a');
    link.href = `zoomphonecall:${formattedPhone}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // 架電履歴を自動保存
  const saveCallHistory = async (phone: string) => {
    console.log('PhoneLink saveCallHistory called:', { user: !!user, customerId, bookId, phone });
    if (!user || !customerId || !bookId) {
      console.log('PhoneLink saveCallHistory: 必要な情報が不足しています', { user: !!user, customerId, bookId });
      return;
    }

    try {
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';

      // デフォルトステータス（priorityが最小のもの）を取得
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

      if (!defaultStatusId) {
        console.error('デフォルトステータスが見つかりません');
        return;
      }

      // 架電履歴を保存
      const callResponse = await fetch(`${apiUrl}/call.v1.CallService/CreateCall`, {
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

      if (!callResponse.ok) {
        console.error('架電履歴の保存に失敗しました');
        return;
      }

      // 架電履歴の保存成功時にコールバックを呼び出し
      onCallCreated?.();
    } catch (error) {
      console.error('架電履歴の保存中にエラーが発生しました:', error);
    }
  };

  // Zoom Phoneで直接発信
  const handlePhoneClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 架電履歴を先に保存
    await saveCallHistory(phone);
    
    const formattedPhone = formatPhoneForTel(phone);
    
    // Zoom Phoneを起動（aタグを動的に作成してページ遷移を防ぐ）
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
