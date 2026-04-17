"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FiCalendar, FiCheckCircle } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

interface ConnectionStatus {
  connected: boolean;
  googleEmail?: string;
  scopes?: string;
}

export default function GoogleCalendarConnectionCard() {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/googleoauth.v1.GoogleOAuthService/GetGoogleConnectionStatus`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setStatus({
        connected: Boolean(data.connected),
        googleEmail: data.google_email ?? data.googleEmail ?? "",
        scopes: data.scopes ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/oauth/google/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { auth_url?: string };
      if (!data.auth_url) throw new Error("no auth_url in response");
      // mock mode では auth_url がそのまま phox-ui の /settings に戻る。
      // real mode では Google 認証画面にリダイレクト。
      window.location.href = data.auth_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!accessToken) return;
    if (!confirm("Google 連携を解除します。よろしいですか？")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/googleoauth.v1.GoogleOAuthService/DisconnectGoogle`,
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
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <FiCalendar className="w-5 h-5" />
          Google カレンダー連携
        </CardTitle>
        <CardDescription>
          掛け直し予定を自動的にあなたの Google カレンダーに追加します
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
        ) : status?.connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiCheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">連携済み</p>
                {status.googleEmail && (
                  <p className="text-xs text-gray-500">{status.googleEmail}</p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleDisconnect}
              disabled={busy}
              aria-label="Google カレンダー連携を解除"
            >
              連携を解除
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">まだ連携されていません</p>
            <Button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
              aria-label="Google カレンダーに連携"
            >
              {busy ? "連携中..." : "Google カレンダーに連携"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
