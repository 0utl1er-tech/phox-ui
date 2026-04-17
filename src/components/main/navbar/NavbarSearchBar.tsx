"use client";

// Navbar 全文検索バー。Elasticsearch + kuromoji バックエンドを 300ms debounce で叩く。
//
// 前回の無限ループ事故 (useEffect deps に auth オブジェクトを入れた) の再発防止ルール:
//   1. Zustand の select は **primitive のみ** (`user?.accessToken` のような string)
//   2. useEffect の deps にもプリミティブのみ (query + accessToken)
//   3. setTimeout の cleanup は必ず clearTimeout を返す
//   4. 空 query の時は fetch せず dropdown を閉じる (早期 return)
//   5. React Strict Mode で effect が 2 回実行されても壊れないよう、effect 内で
//      abort controller を使ってレース状態を防ぐ

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiSearch, FiLoader } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";

// Connect-Go は proto の snake_case フィールドを JSON で lowerCamelCase として
// 返すので TypeScript 側では camelCase で受ける。
interface SearchHitRaw {
  customerId?: string;
  bookId?: string;
  name?: string;
  corporation?: string;
  address?: string;
  phone?: string;
  prefecture?: string;
  // 万一 snake_case でも来たとき用 (reindex 手動テストで curl からはこっち)
  customer_id?: string;
  book_id?: string;
}

interface SearchHit {
  customerId: string;
  bookId: string;
  name: string;
  corporation: string;
  address: string;
  phone: string;
  prefecture: string;
}

function normalizeHit(raw: SearchHitRaw): SearchHit {
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

interface SearchResponse {
  hits?: SearchHitRaw[];
  total?: number;
}

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;

export function NavbarSearchBar() {
  // プリミティブだけ select (オブジェクト select 禁止)
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced fetch. deps は **プリミティブのみ**。
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !accessToken) {
      setHits([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timerId = setTimeout(async () => {
      setIsLoading(true);
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
            body: JSON.stringify({ query: trimmed, limit: MAX_RESULTS }),
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          setHits([]);
          setIsOpen(false);
          return;
        }
        const data: SearchResponse = await response.json();
        const normalized = (data.hits ?? []).map(normalizeHit);
        setHits(normalized);
        setIsOpen(normalized.length > 0);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          console.error("NavbarSearch: fetch failed", err);
        }
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timerId);
      controller.abort();
    };
  }, [query, accessToken]);

  // 外側クリックで dropdown を閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (hit: SearchHit) => {
    setQuery("");
    setHits([]);
    setIsOpen(false);
    router.push(`/book/${hit.bookId}/customer/${hit.customerId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQuery("");
      setIsOpen(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xl mx-6">
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="search"
          role="searchbox"
          aria-label="全文検索"
          placeholder="顧客を検索 (名前・会社・住所・電話・メモ)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => hits.length > 0 && setIsOpen(true)}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isLoading && (
          <FiLoader className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {isOpen && hits.length > 0 && (
        <div
          data-testid="navbar-search-results"
          className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden"
        >
          {hits.map((hit) => (
            <button
              key={hit.customerId}
              type="button"
              onClick={() => handleSelect(hit)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex flex-col gap-0.5"
            >
              <div className="text-sm font-medium text-gray-900 truncate">
                {hit.name || "(名前なし)"}
                {hit.corporation && (
                  <span className="ml-2 text-xs text-gray-500">{hit.corporation}</span>
                )}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {hit.prefecture && <span className="mr-1">[{hit.prefecture}]</span>}
                {hit.address}
                {hit.phone && <span className="ml-2">{hit.phone}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
