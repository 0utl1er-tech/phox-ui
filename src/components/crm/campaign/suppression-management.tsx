"use client";

// Phase 27a: サプレッションリスト管理 (会社単位の配信停止/バウンス/手動除外)。
// 設定画面に Card として埋め込む。reason=manual の行だけ削除できる —
// unsubscribe / hard_bounce / complaint 由来は法令・運用上解除不可。

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FiLoader, FiPlus, FiSearch, FiSlash, FiTrash2 } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import {
  type Suppression,
  normalizeSuppression,
  parseConnectError,
  formatTimestamp,
} from "@/lib/campaign";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
const PAGE_SIZE = 50;

const REASON_LABELS: Record<string, { label: string; className: string }> = {
  unsubscribe: { label: "配信停止", className: "bg-red-100 text-red-800" },
  hard_bounce: { label: "バウンス", className: "bg-yellow-100 text-yellow-800" },
  complaint: { label: "苦情", className: "bg-orange-100 text-orange-800" },
  manual: { label: "手動", className: "bg-gray-100 text-gray-700" },
};

export default function SuppressionManagement() {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSuppressions = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (search) payload.search = search;
      const response = await fetch(
        `${API_URL}/campaign.v1.CampaignService/ListSuppressions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(parseConnectError(text, response.status));
      }
      const data = await response.json();
      setSuppressions(
        (data.suppressions ?? []).map((s: any) => normalizeSuppression(s)),
      );
      setTotal(Number(data.total ?? 0));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`サプレッションリストの取得に失敗しました: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page, search]);

  useEffect(() => {
    void fetchSuppressions();
  }, [fetchSuppressions]);

  const handleSearch = () => {
    setPage(0);
    setSearch(searchInput.trim());
  };

  const handleAdd = async () => {
    if (!accessToken || !newEmail.trim() || isAdding) return;
    setIsAdding(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/campaign.v1.CampaignService/AddSuppression`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: newEmail.trim(), note: newNote.trim() }),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(parseConnectError(text, response.status));
      }
      setNewEmail("");
      setNewNote("");
      void fetchSuppressions();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`追加に失敗しました: ${message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (s: Suppression) => {
    if (!accessToken || deletingId) return;
    if (!window.confirm(`${s.email} をサプレッションリストから削除しますか?`)) return;
    setDeletingId(s.id);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/campaign.v1.CampaignService/RemoveSuppression`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: s.id }),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(parseConnectError(text, response.status));
      }
      setSuppressions((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`削除に失敗しました: ${message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <FiSlash className="w-5 h-5" />
          配信除外リスト (サプレッション)
        </CardTitle>
        <CardDescription>
          ここに登録されたアドレスにはキャンペーンメールを送信しません。
          配信停止・バウンス由来の行は法令・運用上解除できません (削除できるのは手動追加分のみ)。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 追加フォーム */}
        <div className="flex flex-wrap gap-2">
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="除外するメールアドレス"
            className="max-w-xs"
            disabled={isAdding}
          />
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="メモ (任意)"
            className="max-w-xs"
            disabled={isAdding}
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={isAdding || !newEmail.trim()}
          >
            {isAdding ? (
              <FiLoader className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <FiPlus className="w-4 h-4 mr-1" />
                追加
              </>
            )}
          </Button>
        </div>

        {/* 検索 */}
        <div className="flex gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="メールアドレスで検索"
            className="max-w-sm"
          />
          <Button type="button" variant="outline" onClick={handleSearch} disabled={isLoading}>
            <FiSearch className="w-4 h-4 mr-1" />
            検索
          </Button>
        </div>

        {/* 一覧 */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 border-b">
                <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">メールアドレス</TableHead>
                <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">理由</TableHead>
                <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">メモ</TableHead>
                <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">登録日時</TableHead>
                <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : suppressions.length > 0 ? (
                suppressions.map((s) => {
                  const reason = REASON_LABELS[s.reason] ?? {
                    label: s.reason || "-",
                    className: "bg-gray-100 text-gray-700",
                  };
                  return (
                    <TableRow key={s.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm text-gray-900">{s.email}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${reason.className}`}
                        >
                          {reason.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs truncate" title={s.note}>
                        {s.note || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatTimestamp(s.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.reason === "manual" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemove(s)}
                            disabled={deletingId === s.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="サプレッションを解除"
                          >
                            {deletingId === s.id ? (
                              <FiLoader className="w-4 h-4 animate-spin" />
                            ) : (
                              <FiTrash2 className="w-4 h-4" />
                            )}
                          </Button>
                        ) : (
                          <span
                            className="text-xs text-gray-400"
                            title="配信停止・バウンス由来のため解除できません"
                          >
                            解除不可
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    {search ? "該当するアドレスがありません" : "サプレッションはまだありません"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ページネーション */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
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
      </CardContent>
    </Card>
  );
}
