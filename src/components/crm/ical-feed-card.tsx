"use client";

// Phase 20e: iCalendar 購読 URL カード (推奨導線)。
//
// Google Calendar OAuth のような重い審査を避けて、Apple Calendar / Google
// Calendar / Outlook / Thunderbird / Fastmail など全ての主要カレンダーで使える
// universal な方式。URL = credential の設計なので、URL 漏洩は redial の閲覧権限
// 漏洩と等価 (read-only, 自分のカレンダーのみ)。チーム内で URL を共有すれば
// 相互にカレンダーを重ねて見ることができる。

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FiCalendar, FiCopy, FiCheck, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

interface FeedInfo {
  url: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ICalFeedCard() {
  const accessToken = useAuthStore((s) => s.user?.accessToken);

  const [feed, setFeed] = useState<FeedInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/icalfeed.v1.ICalFeedService/GetICalFeed`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.feed) {
        setFeed({
          url: data.feed.url,
          createdAt: data.feed.created_at ?? data.feed.createdAt,
          updatedAt: data.feed.updated_at ?? data.feed.updatedAt,
        });
      } else {
        setFeed(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const callRpc = async (path: string) => {
    if (!accessToken) return null;
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await callRpc("/icalfeed.v1.ICalFeedService/GenerateICalFeed");
      if (data?.feed) {
        setFeed({
          url: data.feed.url,
          createdAt: data.feed.created_at ?? data.feed.createdAt,
          updatedAt: data.feed.updated_at ?? data.feed.updatedAt,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("URL を再生成します。現在購読しているカレンダーアプリは再登録が必要になります。よろしいですか？")) return;
    setBusy(true);
    setError(null);
    try {
      const data = await callRpc("/icalfeed.v1.ICalFeedService/RegenerateICalFeed");
      if (data?.feed) {
        setFeed({
          url: data.feed.url,
          createdAt: data.feed.created_at ?? data.feed.createdAt,
          updatedAt: data.feed.updated_at ?? data.feed.updatedAt,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm("購読 URL を無効化します。現在購読中のカレンダーアプリはエラーになります。よろしいですか？")) return;
    setBusy(true);
    setError(null);
    try {
      await callRpc("/icalfeed.v1.ICalFeedService/RevokeICalFeed");
      setFeed(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!feed) return;
    try {
      await navigator.clipboard.writeText(feed.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("クリップボードへのコピーに失敗しました");
    }
  };

  return (
    <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <FiCalendar className="w-5 h-5" />
          カレンダー購読 URL
        </CardTitle>
        <CardDescription>
          掛け直し予定を Apple Calendar / Google Calendar / Outlook / Thunderbird 等に
          自動反映します。<code className="text-xs">webcal://</code> で始まる URL を
          クリックすると OS がカレンダーアプリを自動起動します。各アプリに登録すると
          約 15 分間隔で最新の予定が取得されます。チームメンバーと URL を共有すれば
          互いのカレンダーを重ねて見ることもできます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {isLoading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : feed == null ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">購読 URL はまだ生成されていません</p>
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
              aria-label="購読URLを生成"
            >
              {busy ? "生成中..." : "購読URLを生成"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="ical-feed-url"
                className="text-sm font-medium text-gray-700"
              >
                購読 URL
              </label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="ical-feed-url"
                  value={feed.url}
                  readOnly
                  aria-label="iCalendar 購読 URL"
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  aria-label="URL をコピー"
                >
                  {copied ? (
                    <>
                      <FiCheck className="w-4 h-4 mr-1" />
                      コピー済
                    </>
                  ) : (
                    <>
                      <FiCopy className="w-4 h-4 mr-1" />
                      コピー
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ⚠️ この URL はシークレットです。外部に公開しないでください。
                漏れた場合は「URL を再生成」してください。
              </p>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-blue-600 hover:underline font-medium">
                📘 使い方を見る
              </summary>
              <div className="mt-3 space-y-3 pl-4 text-gray-700">
                <div>
                  <strong>macOS Calendar.app</strong>:
                  <br />
                  メニューバー → ファイル → 新規照会カレンダー → 上の URL を貼付
                </div>
                <div>
                  <strong>iPhone / iPad</strong>:
                  <br />
                  設定アプリ → カレンダー → アカウント → アカウントを追加 → その他 →
                  照会するカレンダーを追加 → URL 貼付
                </div>
                <div>
                  <strong>Google Calendar</strong>:
                  <br />
                  左サイドバー「他のカレンダー」の「+」→「URL で追加」→ URL 貼付
                  <br />
                  <span className="text-xs text-gray-500">
                    ※ Google Calendar の更新は最大 24 時間遅延します
                  </span>
                </div>
                <div>
                  <strong>Outlook / Thunderbird</strong>:
                  <br />
                  「インターネット カレンダーの購読」機能から URL を登録
                </div>
              </div>
            </details>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={busy}
                aria-label="URL を再生成"
              >
                <FiRefreshCw className="w-4 h-4 mr-1" />
                URL を再生成
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRevoke}
                disabled={busy}
                aria-label="購読 URL を無効化"
                className="text-red-600 hover:bg-red-50"
              >
                <FiTrash2 className="w-4 h-4 mr-1" />
                無効化
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
