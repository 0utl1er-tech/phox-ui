"use client";

// グローバル顧客一覧ページ。SearchSidebar の都道府県 + キーワードを受け取り、
// backend の SearchCustomers RPC (ES バックエンド) を叩く。未認証・ES 未起動の
// ときは空リストで degraded モード表示する。

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { FiUser, FiPhone } from "react-icons/fi";
import SearchSidebar, { SearchFilter } from "@/components/crm/SearchSidebar";
import { useAuthStore } from "@/store/authStore";

interface SearchHit {
  customerId: string;
  bookId: string;
  name: string;
  corporation: string;
  address: string;
  phone: string;
  prefecture: string;
}

interface RawHit {
  customerId?: string;
  bookId?: string;
  customer_id?: string;
  book_id?: string;
  name?: string;
  corporation?: string;
  address?: string;
  phone?: string;
  prefecture?: string;
}

function normalizeHit(raw: RawHit): SearchHit {
  return {
    customerId: raw.customerId ?? raw.customer_id ?? "",
    bookId: raw.bookId ?? raw.book_id ?? "",
    name: raw.name ?? "",
    corporation: raw.corporation ?? "",
    address: raw.address ?? "",
    phone: raw.phone ?? "",
    prefecture: raw.prefecture ?? "",
  };
}

export default function CustomerListPage() {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SearchFilter>({ query: "", prefecture: "" });

  const search = useCallback(
    async (f: SearchFilter) => {
      if (!accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
        const response = await fetch(
          `${apiUrl}/search.v1.SearchService/SearchCustomers`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: f.query,
              prefecture: f.prefecture,
              limit: 100,
            }),
          },
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `HTTP ${response.status}`);
        }
        const data = await response.json();
        const rawHits: RawHit[] = data.hits ?? [];
        setHits(rawHits.map(normalizeHit));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown error";
        setError(`検索に失敗しました: ${msg}`);
        setHits([]);
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  // 初回ロード: 空 query + prefecture=全て で全件表示
  useEffect(() => {
    if (accessToken) {
      void search({ query: "", prefecture: "" });
    }
  }, [accessToken, search]);

  const handleFilterChange = (f: SearchFilter) => {
    setFilter(f);
    void search(f);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
      <SearchSidebar onFilterChange={handleFilterChange} loading={loading} />

      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">顧客一覧</h1>
            {(filter.query || filter.prefecture) && (
              <p className="text-sm text-gray-600 mt-1">
                フィルタ: {filter.prefecture && `都道府県=${filter.prefecture}`}
                {filter.prefecture && filter.query && " / "}
                {filter.query && `キーワード=${filter.query}`}
              </p>
            )}
          </div>

          <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="justify-between">
              <CardTitle className="text-xl font-semibold text-gray-900">検索結果</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <p className="text-gray-500">読み込み中...</p>
                </div>
              ) : error ? (
                <p className="text-red-500">{error}</p>
              ) : hits.length === 0 ? (
                <p className="text-gray-500 text-center py-8">該当する顧客が見つかりません</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
                        <TableHead className="text-white font-medium">顧客名</TableHead>
                        <TableHead className="text-white font-medium">会社名</TableHead>
                        <TableHead className="text-white font-medium">都道府県</TableHead>
                        <TableHead className="text-white font-medium">住所</TableHead>
                        <TableHead className="text-white font-medium">電話</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hits.map((hit) => (
                        <TableRow key={hit.customerId} className="hover:bg-gray-50">
                          <TableCell>
                            <Link
                              href={`/book/${hit.bookId}/customer/${hit.customerId}`}
                              className="block hover:bg-gray-50 p-2 -m-2 rounded"
                            >
                              <div className="flex items-center gap-2">
                                <FiUser className="w-4 h-4 text-gray-500" />
                                <span className="font-medium text-gray-900">
                                  {hit.name || "(名前なし)"}
                                </span>
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>{hit.corporation || "-"}</TableCell>
                          <TableCell>
                            {hit.prefecture ? (
                              <Badge variant="outline" className="border-gray-300">
                                {hit.prefecture}
                              </Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-700 truncate max-w-xs">
                            {hit.address || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <FiPhone className="w-3 h-3 text-gray-500" />
                              {hit.phone || "-"}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {hits.length > 0 && (
                <p className="mt-4 text-sm text-gray-600 text-right">{hits.length} 件</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
