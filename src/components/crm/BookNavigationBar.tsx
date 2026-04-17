"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FiChevronLeft,
  FiChevronRight,
  FiArrowLeft,
  FiBook,
  FiSettings,
} from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import { useBookNavStore } from "@/store/bookNavStore";

interface BookNavigationBarProps {
  bookId: string;
  customerId?: string;
}

/**
 * Book ナビゲーションバー — Soft UI スタイル。
 * Book スコープの情報のみ表示。検索・ユーザー設定はメイン Navbar に委譲。
 */
export default function BookNavigationBar({ bookId, customerId }: BookNavigationBarProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.user?.accessToken);

  const bookName = useBookNavStore((s) => s.bookName);
  const allBooks = useBookNavStore((s) => s.allBooks);
  const siblingIds = useBookNavStore((s) => s.siblingIds);
  const totalCount = useBookNavStore((s) => s.totalCount);
  const load = useBookNavStore((s) => s.load);

  useEffect(() => {
    if (accessToken && bookId) load(bookId, accessToken);
  }, [accessToken, bookId, load]);

  const isDetail = !!customerId;
  const currentIdx = customerId ? siblingIds.indexOf(customerId) : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < siblingIds.length - 1;

  // Keyboard: j/k/Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const tag = el?.tagName;
      const inForm = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "Escape") {
        if (inForm) { e.preventDefault(); el.blur(); return; }
        if (isDetail) { e.preventDefault(); router.push(`/book/${bookId}`); }
        return;
      }
      if (inForm || !isDetail || siblingIds.length === 0) return;
      const idx = siblingIds.indexOf(customerId!);
      if (idx === -1) return;
      if (e.key === "j" && idx < siblingIds.length - 1) {
        e.preventDefault();
        router.push(`/book/${bookId}/customer/${siblingIds[idx + 1]}`);
      } else if (e.key === "k" && idx > 0) {
        e.preventDefault();
        router.push(`/book/${bookId}/customer/${siblingIds[idx - 1]}`);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetail, siblingIds, customerId, bookId, router]);

  const progressPct = totalCount > 0 && currentIdx >= 0
    ? ((currentIdx + 1) / totalCount) * 100
    : 0;

  return (
    <div className="sticky top-2 z-[9999] px-4 pointer-events-none">
      <div className="max-w-5xl mx-auto pointer-events-auto">
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/5 border border-white/50 px-5 py-2.5">
          <div className="flex items-center gap-4">

            {/* 左: 戻る + Book セレクタ + 件数 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {isDetail && (
                <button
                  type="button"
                  onClick={() => router.push(`/book/${bookId}`)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  title="一覧に戻る (Esc)"
                >
                  <FiArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
              )}
              <FiBook className="w-4 h-4 text-blue-500 flex-shrink-0" />
              {allBooks.length > 1 ? (
                <select
                  value={bookId}
                  onChange={(e) => router.push(`/book/${e.target.value}`)}
                  className="bg-transparent text-sm font-semibold text-gray-800 border-none cursor-pointer focus:outline-none max-w-[180px] truncate pr-4"
                >
                  {allBooks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-sm font-semibold text-gray-800 truncate max-w-[180px]">
                  {bookName || "..."}
                </span>
              )}
              <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
                {totalCount.toLocaleString()} 件
              </span>
            </div>

            {/* 中央スペーサー */}
            <div className="flex-1" />

            {/* 右: ナビゲーション + 設定 */}
            <div className="flex items-center gap-2 flex-shrink-0">

              {/* 詳細画面: POS + j/k ナビ */}
              {isDetail && currentIdx >= 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!hasPrev}
                    onClick={() => hasPrev && router.push(`/book/${bookId}/customer/${siblingIds[currentIdx - 1]}`)}
                    className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-25 transition-colors"
                    title="前 (k)"
                  >
                    <FiChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="text-xs tabular-nums text-gray-500 min-w-[4rem] text-center">
                    {(currentIdx + 1).toLocaleString()}/{totalCount.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    disabled={!hasNext}
                    onClick={() => hasNext && router.push(`/book/${bookId}/customer/${siblingIds[currentIdx + 1]}`)}
                    className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-25 transition-colors"
                    title="次 (j)"
                  >
                    <FiChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="w-px h-5 bg-gray-200 ml-1" />
                </div>
              )}

              {/* Book 設定 */}
              <button
                type="button"
                onClick={() => router.push(`/book/${bookId}/settings`)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="ブック設定"
              >
                <FiSettings className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
