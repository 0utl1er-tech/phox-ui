"use client";

// Phase 27f: 管理者設定 (会社単位) — 通話記録モード。
// 設定画面に Card として埋め込む。閲覧は誰でも可、変更はオーナーのみ
// (canEdit=false ならラジオを無効化して案内を出す)。

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FiLoader, FiSettings } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import { parseConnectError } from "@/lib/campaign";
import {
  type CallLogMode,
  fetchCompanySettings,
  invalidateCompanySettingsCache,
} from "@/lib/company-settings";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

const MODE_OPTIONS: { value: CallLogMode; label: string; description: string }[] = [
  {
    value: "click",
    label: "クリック時に記録 (従来)",
    description:
      "電話番号クリックで発信し、Zoom API 発信に失敗した場合もフォールバックでコール活動を自動記録します。",
  },
  {
    value: "zoom",
    label: "Zoom通話履歴をマスターにする (推奨)",
    description:
      "発信クリックでは記録せず、実際の通話がZoomから同期されます。webhook取りこぼしは毎時自動回収されます。",
  },
];

export default function AdminSettings() {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [mode, setMode] = useState<CallLogMode>("click");
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const settings = await fetchCompanySettings(accessToken);
      setMode(settings.callLogMode);
      setCanEdit(settings.canEdit);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`設定の取得に失敗しました: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSelect = async (next: CallLogMode) => {
    if (!accessToken || !canEdit || isSaving || next === mode) return;
    const previous = mode;
    setMode(next); // 楽観更新 (失敗時に戻す)
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${API_URL}/company.v1.CompanyService/UpdateSettings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ call_log_mode: next }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(parseConnectError(text, response.status));
      }
      invalidateCompanySettingsCache();
      setSuccessMessage("通話記録モードを更新しました");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: unknown) {
      setMode(previous);
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`更新に失敗しました: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <FiSettings className="w-5 h-5" />
          管理者設定
        </CardTitle>
        <CardDescription>
          会社全体に適用される設定です。
          {!isLoading && !canEdit && (
            <span className="block mt-1 text-amber-700">変更にはオーナー権限が必要です</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-6">
            <FiLoader className="w-5 h-5 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">読み込み中...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-600">{successMessage}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">通話記録モード</p>
              <div className="space-y-2">
                {MODE_OPTIONS.map((option) => {
                  const selected = mode === option.value;
                  const disabled = !canEdit || isSaving;
                  return (
                    <label
                      key={option.value}
                      className={[
                        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                        selected ? "border-blue-400 bg-blue-50/60" : "border-gray-200 bg-white",
                        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-blue-300",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="call-log-mode"
                        value={option.value}
                        checked={selected}
                        disabled={disabled}
                        onChange={() => void handleSelect(option.value)}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-gray-900">{option.label}</span>
                        <span className="block text-sm text-gray-500">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {isSaving && (
                <p className="mt-2 text-sm text-gray-500 flex items-center gap-1">
                  <FiLoader className="w-4 h-4 animate-spin" />
                  保存中...
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
