"use client";

// Book 横断の活動フィード。Book 内の全顧客のコール / メール送受信を
// 時系列で一覧する。種別 / 担当者 / 期間で絞り込み、50 件ずつページング。
// データは ActivityService.ListActivitiesByBookID (Phase 23 で追加)。

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiActivity,
  FiArrowLeft,
  FiChevronLeft,
  FiChevronRight,
  FiMail,
  FiPhone,
  FiInbox,
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import BookNavigationBar from "@/components/crm/BookNavigationBar";
import { useAuthStore } from "@/store/authStore";
import {
  type FeedActivity,
  type PeriodPreset,
  formatDateTime,
  formatDuration,
  normalizeFeedActivity,
  presetToRange,
} from "@/lib/activity";

const PAGE_SIZE = 50;
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

type TypeFilter = "all" | "call" | "email_sent" | "email_received";

const TYPE_FILTER_TO_PROTO: Record<TypeFilter, string[]> = {
  all: [],
  call: ["ACTIVITY_TYPE_CALL"],
  email_sent: ["ACTIVITY_TYPE_EMAIL_SENT"],
  email_received: ["ACTIVITY_TYPE_EMAIL_RECEIVED"],
};

interface BookUser {
  userId: string;
  userName: string;
}

interface ActivityFeedPageProps {
  params: Promise<{ book_id: string }>;
}

export default function ActivityFeedPage({ params }: ActivityFeedPageProps) {
  const { book_id: bookId } = use(params);
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.user?.accessToken);

  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [bookUsers, setBookUsers] = useState<BookUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 担当者フィルタ用に book のユーザー一覧を取得
  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/permit.v1.PermitService/ListBookUsers`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ book_id: bookId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setBookUsers(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.users ?? []).map((u: any) => ({
            userId: u.userId ?? u.user_id ?? "",
            userName: u.userName ?? u.user_name ?? "",
          })),
        );
      } catch {
        // 担当者フィルタが出ないだけなので握りつぶす
      }
    })();
  }, [accessToken, bookId]);

  const loadActivities = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const range = presetToRange(preset, customFrom, customTo);
      const res = await fetch(
        `${API_URL}/activity.v1.ActivityService/ListActivitiesByBookID`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            book_id: bookId,
            types: TYPE_FILTER_TO_PROTO[typeFilter],
            ...(userFilter !== "all" ? { user_id: userFilter } : {}),
            ...(range.from ? { occurred_from: range.from } : {}),
            ...(range.to ? { occurred_to: range.to } : {}),
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          }),
        },
      );
      if (!res.ok) throw new Error(`活動履歴の取得に失敗しました (${res.status})`);
      const data = await res.json();
      setActivities((data.activities ?? []).map(normalizeFeedActivity));
      setTotalCount(Number(data.totalCount ?? data.total_count ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "活動履歴の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, bookId, typeFilter, userFilter, preset, customFrom, customTo, page]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // フィルタ変更時は 1 ページ目へ戻す
  const resetPageAnd = <T,>(setter: (v: T) => void) => (v: T) => {
    setPage(0);
    setter(v);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <BookNavigationBar bookId={bookId} />
      <div className="max-w-6xl mx-auto p-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link href={`/book/${bookId}`}>
            <Button variant="ghost" className="mb-4">
              <FiArrowLeft className="w-4 h-4 mr-2" />
              顧客一覧に戻る
            </Button>
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <FiActivity className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">活動フィード</h1>
              <span className="text-sm text-gray-400 tabular-nums">
                {totalCount.toLocaleString()} 件
              </span>
            </div>
            <Link href={`/book/${bookId}/stats`}>
              <Button variant="outline" size="sm">集計を見る</Button>
            </Link>
          </div>
        </div>

        <Card className="border border-gray-200 bg-white rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* 種別 */}
              <ToggleGroup
                type="single"
                value={typeFilter}
                onValueChange={(v) => v && resetPageAnd(setTypeFilter)(v as TypeFilter)}
              >
                <ToggleGroupItem value="all">全て</ToggleGroupItem>
                <ToggleGroupItem value="call">コール</ToggleGroupItem>
                <ToggleGroupItem value="email_sent">送信メール</ToggleGroupItem>
                <ToggleGroupItem value="email_received">受信メール</ToggleGroupItem>
              </ToggleGroup>

              {/* 担当者 */}
              <Select value={userFilter} onValueChange={resetPageAnd(setUserFilter)}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="担当者" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全担当者</SelectItem>
                  {bookUsers.map((u) => (
                    <SelectItem key={u.userId} value={u.userId}>
                      {u.userName || u.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 期間 */}
              <Select
                value={preset}
                onValueChange={(v) => resetPageAnd(setPreset)(v as PeriodPreset)}
              >
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="期間" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全期間</SelectItem>
                  <SelectItem value="today">今日</SelectItem>
                  <SelectItem value="week">今週</SelectItem>
                  <SelectItem value="month">今月</SelectItem>
                  <SelectItem value="custom">期間指定</SelectItem>
                </SelectContent>
              </Select>
              {preset === "custom" && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => resetPageAnd(setCustomFrom)(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                  <span>〜</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => resetPageAnd(setCustomTo)(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="border rounded-2xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b">
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">日時</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">種別</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">顧客</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">内容</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">担当者</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">結果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-gray-400">
                        読み込み中...
                      </TableCell>
                    </TableRow>
                  ) : activities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-gray-400">
                        条件に一致する活動がありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    activities.map((a) => {
                      const { date, time } = formatDateTime(a.occurredAt);
                      return (
                        <TableRow
                          key={a.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() =>
                            router.push(`/book/${bookId}/customer/${a.customerId}`)
                          }
                        >
                          <TableCell className="whitespace-nowrap">
                            <div className="text-sm text-gray-900">{date}</div>
                            <div className="text-xs text-gray-400">{time}</div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <TypeBadge type={a.type} />
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[180px]">
                              {a.customerName || "-"}
                            </div>
                            {a.customerCorporation && (
                              <div className="text-xs text-gray-400 truncate max-w-[180px]">
                                {a.customerCorporation}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {a.type === "call" ? (
                              <div className="text-sm text-gray-700">
                                {a.phone || "-"}
                                {a.durationSeconds ? (
                                  <span className="ml-2 text-xs text-gray-400">
                                    ({formatDuration(a.durationSeconds)})
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-700 truncate max-w-[260px]">
                                {a.subject || "(件名なし)"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-gray-700">
                            {a.userName || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {a.statusName ? (
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                  a.statusNg
                                    ? "bg-red-50 text-red-700"
                                    : a.statusEffective
                                      ? "bg-green-50 text-green-700"
                                      : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {a.statusName}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ページネーション */}
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <FiChevronLeft className="w-4 h-4 mr-1" />
                  前へ
                </Button>
                <span className="text-sm text-gray-500 tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  次へ
                  <FiChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: FeedActivity["type"] }) {
  switch (type) {
    case "call":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          <FiPhone className="w-3 h-3" />
          コール
        </span>
      );
    case "email_sent":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
          <FiMail className="w-3 h-3" />
          送信
        </span>
      );
    case "email_received":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
          <FiInbox className="w-3 h-3" />
          受信
        </span>
      );
    default:
      return <span className="text-xs text-gray-400">-</span>;
  }
}
