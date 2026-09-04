"use client";

// Phase 27f: 管理者設定 (会社単位) — 通話記録モード。
// Phase 27h: 反響通知 (キャンペーンイベントの Discord Webhook 通知)。
// Phase 28f: キャンペーン自動下書き (投函された Book から下書きを自動生成)。
// 設定画面に Card として埋め込む。閲覧は誰でも可、変更はオーナーのみ
// (canEdit=false ならフォームを無効化して案内を出す)。

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FiBell, FiLoader, FiSettings } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import { parseConnectError } from "@/lib/campaign";
import AutoDraftSettings from "@/components/crm/campaign/autodraft-settings";
import {
  type CallLogMode,
  type NotifyEvent,
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

// Phase 27h: 反響通知のイベント種別 (既定: reply のみ ON)。
const NOTIFY_EVENT_OPTIONS: { value: NotifyEvent; label: string; description: string }[] = [
  {
    value: "reply",
    label: "返信",
    description: "キャンペーンメールに顧客から返信が届いたとき (初回のみ)。",
  },
  {
    value: "click",
    label: "クリック",
    description: "メール内のリンクが初めてクリックされたとき。",
  },
  {
    value: "unsubscribe",
    label: "配信停止",
    description: "顧客が配信停止リンクを踏んだとき。",
  },
  {
    value: "bounce",
    label: "バウンス",
    description: "メールが宛先不明などで届かなかったとき。",
  },
  {
    value: "open",
    label: "開封",
    description:
      "メールが初めて開封されたとき。メールクライアントのプロキシで多重計上されるためノイズ多め。",
  },
  {
    value: "autodraft",
    label: "自動下書きの作成",
    description:
      "投函されたリストからキャンペーンの下書きが自動生成されたとき (Phase 28f)。送信は開始されません。",
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
  // Phase 27h: 反響通知
  const [notifyUrl, setNotifyUrl] = useState("");
  const [notifyEvents, setNotifyEvents] = useState<NotifyEvent[]>([]);
  const [isSavingNotify, setIsSavingNotify] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const settings = await fetchCompanySettings(accessToken);
      setMode(settings.callLogMode);
      setCanEdit(settings.canEdit);
      setNotifyUrl(settings.notifyWebhookUrl);
      setNotifyEvents(settings.notifyEvents);
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

  const toggleNotifyEvent = (event: NotifyEvent) => {
    setNotifyEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  // Phase 27h: 反響通知設定の保存。call_log_mode は送らない (空 = 変更なし)。
  const handleSaveNotify = async () => {
    if (!accessToken || !canEdit || isSavingNotify) return;
    setIsSavingNotify(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${API_URL}/company.v1.CompanyService/UpdateSettings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notify_webhook_url: notifyUrl.trim(),
          notify_events: notifyEvents.join(","),
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(parseConnectError(text, response.status));
      }
      invalidateCompanySettingsCache();
      setSuccessMessage("反響通知の設定を保存しました");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`更新に失敗しました: ${message}`);
    } finally {
      setIsSavingNotify(false);
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

            {/* Phase 27h: 反響通知 (Discord Webhook) */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <FiBell className="w-4 h-4" />
                反響通知
              </p>
              <p className="text-sm text-gray-500 mb-3">
                キャンペーンの反響 (返信など) を Discord に通知します。DiscordのチャンネルからWebhookを発行して貼り付けてください。
              </p>

              <label className="block mb-3">
                <span className="block text-sm text-gray-700 mb-1">Discord Webhook URL</span>
                <input
                  type="text"
                  value={notifyUrl}
                  onChange={(e) => setNotifyUrl(e.target.value)}
                  disabled={!canEdit || isSavingNotify}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                />
                {!canEdit && (
                  <span className="block mt-1 text-xs text-gray-400">
                    URL はオーナーのみ閲覧・変更できます
                  </span>
                )}
              </label>

              <div className="space-y-2 mb-3">
                {NOTIFY_EVENT_OPTIONS.map((option) => {
                  const checked = notifyEvents.includes(option.value);
                  const disabled = !canEdit || isSavingNotify;
                  return (
                    <label
                      key={option.value}
                      className={[
                        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                        checked ? "border-blue-400 bg-blue-50/60" : "border-gray-200 bg-white",
                        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-blue-300",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleNotifyEvent(option.value)}
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

              {canEdit && (
                <button
                  type="button"
                  onClick={() => void handleSaveNotify()}
                  disabled={isSavingNotify}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingNotify && <FiLoader className="w-4 h-4 animate-spin" />}
                  {isSavingNotify ? "保存中..." : "通知設定を保存"}
                </button>
              )}
            </div>

            {/* Phase 28f: キャンペーン自動下書き (Book 投函 → 下書き自動生成) */}
            <AutoDraftSettings canEdit={canEdit} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
