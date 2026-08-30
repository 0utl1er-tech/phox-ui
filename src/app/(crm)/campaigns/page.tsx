"use client";

// Phase 27a: コールドメールキャンペーン一覧ページ。

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FiPlus, FiSend } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import { CampaignStatusBadge } from "@/components/crm/campaign/StatusBadge";
import {
  type Campaign,
  normalizeCampaign,
  parseConnectError,
  formatTimestamp,
} from "@/lib/campaign";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
const PAGE_SIZE = 50;

export default function CampaignListPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/campaign.v1.CampaignService/ListCampaigns`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(parseConnectError(text, response.status));
      }
      const data = await response.json();
      setCampaigns((data.campaigns ?? []).map((c: any) => normalizeCampaign(c)));
      setTotal(Number(data.total ?? 0));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`キャンペーン一覧の取得に失敗しました: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiSend className="w-6 h-6 text-blue-600" />
            キャンペーン
          </h1>
          <Button
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            onClick={() => router.push("/campaigns/new")}
          >
            <FiPlus className="w-4 h-4 mr-2" />
            新規キャンペーン
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <p className="text-gray-500">読み込み中...</p>
          </div>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : !accessToken ? (
          <p className="text-gray-500">ログインしてください。</p>
        ) : (
          <div className="border rounded-2xl overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">キャンペーン名</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">ステータス</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider text-right">送信数</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider text-right">返信数</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider text-right">配停数</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">作成日時</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.length > 0 ? (
                  campaigns.map((c) => (
                    <TableRow
                      key={c.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/campaigns/${c.id}`)}
                    >
                      <TableCell>
                        <span className="font-medium text-gray-900">{c.name || "(名前なし)"}</span>
                      </TableCell>
                      <TableCell>
                        <CampaignStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-gray-700">
                        {c.stats.sent.toLocaleString()} / {c.stats.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-gray-700">
                        {c.stats.replied.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-gray-700">
                        {c.stats.unsubscribed.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatTimestamp(c.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      キャンペーンがまだありません。顧客一覧で受信者を選択して作成してください。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ページネーション */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-gray-600">
              {total} 件中 {page * PAGE_SIZE + 1}〜{Math.min((page + 1) * PAGE_SIZE, total)} 件
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← 前へ
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-700">
                {page + 1} / {Math.ceil(total / PAGE_SIZE)}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total}
                className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                次へ →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
