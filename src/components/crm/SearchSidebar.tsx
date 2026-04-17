"use client";

// SearchSidebar — 顧客検索サイドバー (都道府県フィルタ + キーワード)。
//
// 旧実装は Book UUID を手貼りする原始 UI だったが、今回の要件で「都道府県別に
// 絞り込めること」が優先課題になったため、47 都道府県ドロップダウン + 自由
// キーワード入力の 2 軸 UI に書き直した。親コンポーネントは `onFilterChange`
// を受けて SearchCustomers API を叩く (詳細は `/customer/page.tsx`)。

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiSearch, FiMapPin, FiX } from "react-icons/fi";
import { PREFECTURES } from "@/lib/prefectures";

export interface SearchFilter {
  query: string;
  prefecture: string;
}

interface SearchSidebarProps {
  onFilterChange: (filter: SearchFilter) => void;
  loading: boolean;
}

export default function SearchSidebar({ onFilterChange, loading }: SearchSidebarProps) {
  const [query, setQuery] = useState("");
  const [prefecture, setPrefecture] = useState("");

  const handleSearch = () => {
    onFilterChange({ query: query.trim(), prefecture });
  };

  const handleClear = () => {
    setQuery("");
    setPrefecture("");
    onFilterChange({ query: "", prefecture: "" });
  };

  return (
    <div className="bg-white shadow-lg border-r border-gray-200 w-80 flex-shrink-0">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">検索条件</h2>

        <div className="space-y-4">
          {/* 都道府県フィルタ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FiMapPin className="w-4 h-4" />
                都道府県
              </CardTitle>
            </CardHeader>
            <CardContent>
              <select
                aria-label="都道府県"
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全て</option>
                {PREFECTURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* キーワード検索 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FiSearch className="w-4 h-4" />
                キーワード
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  aria-label="キーワード"
                  placeholder="名前・会社・住所など"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            >
              {loading ? "検索中..." : "検索"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
              disabled={loading}
              aria-label="クリア"
              title="条件をクリア"
            >
              <FiX className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
