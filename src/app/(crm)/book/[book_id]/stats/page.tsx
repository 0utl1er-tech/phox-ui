"use client";

// 集計画面 — コール / メールの担当者別アクティビティ集計。
//   - コール集計: 担当者 × コール結果 (Status) のクロス集計。セルは件数、
//     背景の濃さで件数の大小を可視化するヒートマップ風の表。
//   - メール集計: 担当者ごとの送信数 / 返信数 / 返信率。返信は
//     「その顧客に最後に送信した担当者」への帰属 (バックエンド側で近似)。
// データは ActivityService.GetCallStats / GetMailStats (Phase 23 で追加)。

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiArrowLeft, FiBarChart2, FiMail, FiPhone } from "react-icons/fi";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import BookNavigationBar from "@/components/crm/BookNavigationBar";
import { useAuthStore } from "@/store/authStore";
import {
  type CallStatsCell,
  type MailStatsRow,
  type PeriodPreset,
  formatDuration,
  normalizeCallStatsCell,
  normalizeMailStatsRow,
  presetToRange,
} from "@/lib/activity";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

interface BookStatus {
  id: string;
  name: string;
  priority: number;
}

interface StatsPageProps {
  params: Promise<{ book_id: string }>;
}

export default function StatsPage({ params }: StatsPageProps) {
  const { book_id: bookId } = use(params);
  const accessToken = useAuthStore((s) => s.user?.accessToken);

  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [callCells, setCallCells] = useState<CallStatsCell[]>([]);
  const [mailRows, setMailRows] = useState<MailStatsRow[]>([]);
  const [statuses, setStatuses] = useState<BookStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const range = presetToRange(preset, customFrom, customTo);
      const periodBody = {
        book_id: bookId,
        ...(range.from ? { occurred_from: range.from } : {}),
        ...(range.to ? { occurred_to: range.to } : {}),
      };
      const post = (path: string, body: object) =>
        fetch(`${API_URL}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

      const [callRes, mailRes, statusRes] = await Promise.all([
        post("/activity.v1.ActivityService/GetCallStats", periodBody),
        post("/activity.v1.ActivityService/GetMailStats", periodBody),
        post("/status.v1.StatusService/ListStatuses", { book_id: bookId }),
      ]);
      if (!callRes.ok || !mailRes.ok) {
        throw new Error(`集計の取得に失敗しました (${callRes.status}/${mailRes.status})`);
      }
      const callData = await callRes.json();
      const mailData = await mailRes.json();
      setCallCells((callData.cells ?? []).map(normalizeCallStatsCell));
      setMailRows((mailData.rows ?? []).map(normalizeMailStatsRow));
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatuses(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (statusData.statuses ?? []).map((s: any) => ({
            id: s.id ?? "",
            name: s.name ?? "",
            priority: Number(s.priority ?? 0),
          })),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "集計の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, bookId, preset, customFrom, customTo]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

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
              <FiBarChart2 className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">集計</h1>
            </div>
            <Link href={`/book/${bookId}/activity`}>
              <Button variant="outline" size="sm">活動フィードを見る</Button>
            </Link>
          </div>
        </div>

        {/* 期間セレクタ */}
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <ToggleGroup
            type="single"
            value={preset}
            onValueChange={(v) => v && setPreset(v as PeriodPreset)}
          >
            <ToggleGroupItem value="today">今日</ToggleGroupItem>
            <ToggleGroupItem value="week">今週</ToggleGroupItem>
            <ToggleGroupItem value="month">今月</ToggleGroupItem>
            <ToggleGroupItem value="all">全期間</ToggleGroupItem>
            <ToggleGroupItem value="custom">期間指定</ToggleGroupItem>
          </ToggleGroup>
          {preset === "custom" && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
              />
              <span>〜</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-6">
          <CallCrossTab cells={callCells} statuses={statuses} isLoading={isLoading} />
          <MailStatsCard rows={mailRows} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

// ─── コール クロス集計 ───────────────────────────────────────────

function CallCrossTab({
  cells,
  statuses,
  isLoading,
}: {
  cells: CallStatsCell[];
  statuses: BookStatus[];
  isLoading: boolean;
}) {
  const { columns, rows, columnTotals, grandTotal, maxCell } = useMemo(() => {
    // 列 = Book の Status (priority 順)。セルに「未設定」(status 削除済み等)
    // があるときだけ末尾に未設定列を足す。
    const hasNullStatus = cells.some((c) => !c.statusId);
    const columns: { id: string | null; name: string }[] = statuses
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((s) => ({ id: s.id, name: s.name }));
    if (hasNullStatus) columns.push({ id: null, name: "未設定" });

    // 行 = 担当者。合計コール数の降順。
    const byUser = new Map<
      string,
      {
        userName: string;
        counts: Map<string | null, number>;
        total: number;
        duration: number;
      }
    >();
    let maxCell = 0;
    for (const c of cells) {
      let row = byUser.get(c.userId);
      if (!row) {
        row = { userName: c.userName, counts: new Map(), total: 0, duration: 0 };
        byUser.set(c.userId, row);
      }
      const key = c.statusId ?? null;
      row.counts.set(key, (row.counts.get(key) ?? 0) + c.count);
      row.total += c.count;
      row.duration += c.totalDurationSeconds;
      maxCell = Math.max(maxCell, row.counts.get(key) ?? 0);
    }
    const rows = [...byUser.entries()]
      .map(([userId, r]) => ({ userId, ...r }))
      .sort((a, b) => b.total - a.total);

    const columnTotals = new Map<string | null, number>();
    for (const col of columns) {
      columnTotals.set(
        col.id,
        rows.reduce((sum, r) => sum + (r.counts.get(col.id) ?? 0), 0),
      );
    }
    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
    return { columns, rows, columnTotals, grandTotal, maxCell };
  }, [cells, statuses]);

  return (
    <Card className="border border-gray-200 bg-white rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FiPhone className="w-4 h-4 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">コール集計</h2>
          <span className="text-xs text-gray-400">担当者 × コール結果</span>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {isLoading ? (
          <div className="py-10 text-center text-gray-400">読み込み中...</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            この期間のコールはありません
          </div>
        ) : (
          <div className="border rounded-2xl overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider min-w-[120px]">
                    担当者
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead
                      key={col.id ?? "__null__"}
                      className="text-gray-500 font-medium text-xs tracking-wider text-center whitespace-nowrap"
                    >
                      {col.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-gray-700 font-semibold text-xs tracking-wider text-center">
                    合計
                  </TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs tracking-wider text-center whitespace-nowrap">
                    通話時間
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.userId} className="hover:bg-gray-50">
                    <TableCell className="text-sm font-medium text-gray-900 whitespace-nowrap">
                      {r.userName || r.userId}
                    </TableCell>
                    {columns.map((col) => {
                      const n = r.counts.get(col.id) ?? 0;
                      // 件数の大小をセル背景の濃さで表現 (最大値を 1 とする)
                      const intensity = maxCell > 0 ? n / maxCell : 0;
                      return (
                        <TableCell
                          key={col.id ?? "__null__"}
                          className="text-center tabular-nums text-sm"
                          style={
                            n > 0
                              ? {
                                  backgroundColor: `rgba(59, 130, 246, ${0.06 + intensity * 0.22})`,
                                }
                              : undefined
                          }
                        >
                          {n > 0 ? n.toLocaleString() : <span className="text-gray-300">·</span>}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center tabular-nums text-sm font-semibold text-gray-900">
                      {r.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center text-xs text-gray-500 whitespace-nowrap">
                      {formatDuration(r.duration)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* 列合計 */}
                <TableRow className="bg-gray-50 border-t">
                  <TableCell className="text-xs font-semibold text-gray-500">合計</TableCell>
                  {columns.map((col) => (
                    <TableCell
                      key={col.id ?? "__null__"}
                      className="text-center tabular-nums text-sm font-semibold text-gray-700"
                    >
                      {(columnTotals.get(col.id) ?? 0).toLocaleString()}
                    </TableCell>
                  ))}
                  <TableCell className="text-center tabular-nums text-sm font-bold text-gray-900">
                    {grandTotal.toLocaleString()}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── メール集計 ─────────────────────────────────────────────────

function MailStatsCard({
  rows,
  isLoading,
}: {
  rows: MailStatsRow[];
  isLoading: boolean;
}) {
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          sent: acc.sent + r.sentCount,
          reply: acc.reply + r.replyCount,
        }),
        { sent: 0, reply: 0 },
      ),
    [rows],
  );

  const replyRate = (r: MailStatsRow) =>
    r.sentCount > 0 ? (r.replyCount / r.sentCount) * 100 : null;

  return (
    <Card className="border border-gray-200 bg-white rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FiMail className="w-4 h-4 text-violet-600" />
          <h2 className="text-base font-semibold text-gray-900">メール集計</h2>
          <span className="text-xs text-gray-400">
            返信は「その顧客に最後に送信した担当者」に帰属
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {isLoading ? (
          <div className="py-10 text-center text-gray-400">読み込み中...</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            この期間のメールはありません
          </div>
        ) : (
          <div className="border rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider min-w-[120px]">
                    担当者
                  </TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs tracking-wider text-center">
                    送信
                  </TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs tracking-wider text-center">
                    返信
                  </TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs tracking-wider min-w-[200px]">
                    返信率
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const rate = replyRate(r);
                  return (
                    <TableRow key={r.userId || "__unattributed__"} className="hover:bg-gray-50">
                      <TableCell className="text-sm font-medium text-gray-900 whitespace-nowrap">
                        {r.userId ? r.userName || r.userId : (
                          <span className="text-gray-400">担当なし (先行送信のない受信)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">
                        {r.sentCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">
                        {r.replyCount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {rate == null ? (
                          <span className="text-xs text-gray-300">-</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[160px]">
                              <div
                                className="h-full bg-violet-500 rounded-full"
                                style={{ width: `${Math.min(100, rate)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-gray-600">
                              {rate.toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* 合計行 */}
                <TableRow className="bg-gray-50 border-t">
                  <TableCell className="text-xs font-semibold text-gray-500">合計</TableCell>
                  <TableCell className="text-center tabular-nums text-sm font-semibold text-gray-900">
                    {totals.sent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm font-semibold text-gray-900">
                    {totals.reply.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {totals.sent > 0
                      ? `全体返信率 ${((totals.reply / totals.sent) * 100).toFixed(0)}%`
                      : ""}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
