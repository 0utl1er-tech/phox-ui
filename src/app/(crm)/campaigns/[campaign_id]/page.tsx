"use client";

// Phase 27a: キャンペーン詳細ページ。
// ステータス操作 (開始/一時停止/再開/中止)・統計カード・受信者一覧・
// テスト送信。
// Phase 27b: 開封→クリック→返信のファネル表示・受信者ごとの計測列・
// 行クリックでイベント履歴ダイアログ (ListRecipientEvents)。
// Phase 27d: Instantly 風ダッシュボード — 日次折れ線チャート
// (GetCampaignTimeseries)・稼働インジケータ (送信窓判定 + lastSentAt)・
// 完了予定カード (estimatedCompletionAt)。running 中は 15 秒ポーリング。

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FiArrowLeft,
  FiCheck,
  FiMail,
  FiPause,
  FiPlay,
  FiRefreshCw,
  FiXCircle,
} from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import {
  CampaignStatusBadge,
  RecipientStatusBadge,
} from "@/components/crm/campaign/StatusBadge";
import { RecipientEventsDialog } from "@/components/crm/campaign/RecipientEventsDialog";
import { CampaignChart } from "@/components/crm/campaign/CampaignChart";
import {
  type Campaign,
  type CampaignDailyStat,
  type CampaignRecipient,
  type CampaignStats,
  normalizeCampaign,
  normalizeDailyStat,
  normalizeRecipient,
  parseConnectError,
  formatTimestamp,
  formatSendDays,
  formatRelativeTime,
  formatEstimatedCompletion,
  formatNextSendWindow,
  fillDailyStats,
  isInSendWindow,
  jstDateString,
} from "@/lib/campaign";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
const PAGE_SIZE = 50;

const RECIPIENT_TABS = [
  { key: "", label: "全部" },
  { key: "queued", label: "待機中" },
  { key: "sent", label: "送信済" },
  { key: "failed", label: "失敗" },
  { key: "skipped", label: "スキップ" },
] as const;

interface CampaignDetailPageProps {
  params: Promise<{ campaign_id: string }>;
}

/** Phase 27b: 送信→開封→クリック→返信のファネルバー。 */
function EngagementFunnel({ stats }: { stats: CampaignStats }) {
  const denominator = Math.max(stats.sent, 1);
  const rows = [
    { label: "送信済", value: stats.sent, barClass: "bg-gray-400" },
    { label: "開封", value: stats.opened, barClass: "bg-blue-500" },
    { label: "クリック", value: stats.clicked, barClass: "bg-green-500" },
    { label: "返信", value: stats.replied, barClass: "bg-purple-500" },
  ];
  const rate = (value: number) =>
    stats.sent > 0 ? `${((value / stats.sent) * 100).toFixed(1)}%` : "-";
  return (
    <div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-gray-500">{row.label}</span>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${row.barClass}`}
                style={{ width: `${Math.min(100, (row.value / denominator) * 100)}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-right text-sm text-gray-700 tabular-nums">
              {row.value.toLocaleString()}
              <span className="text-xs text-gray-400 ml-1">({rate(row.value)})</span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 pt-3 border-t text-xs">
        <span className="text-orange-600">
          バウンス: {stats.bounced.toLocaleString()} ({rate(stats.bounced)})
        </span>
        <span className="text-red-600">
          配信停止: {stats.unsubscribed.toLocaleString()} ({rate(stats.unsubscribed)})
        </span>
      </div>
    </div>
  );
}

/** Phase 27d: running 中の稼働インジケータ (送信窓の内外で緑パルス/黄)。 */
function RunningIndicator({
  campaign,
  todaySent,
}: {
  campaign: Campaign;
  todaySent: number;
}) {
  const inWindow = isInSendWindow(campaign.schedule);
  const nextWindow = formatNextSendWindow(campaign.schedule);
  const lastSentRel = formatRelativeTime(campaign.stats.lastSentAt);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="relative flex h-3 w-3">
        {inWindow && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${
            inWindow ? "bg-green-500" : "bg-yellow-400"
          }`}
        />
      </span>
      <span
        className={`text-sm font-medium ${inWindow ? "text-green-700" : "text-yellow-700"}`}
      >
        {inWindow
          ? "送信中"
          : `待機中 (送信時間外${nextWindow ? ` — 次は${nextWindow}から` : ""})`}
      </span>
      <span className="text-xs text-gray-500">
        {lastSentRel && <>最終送信: {lastSentRel} ・ </>}
        本日 {todaySent.toLocaleString()}通送信済み
      </span>
    </div>
  );
}

/** Phase 27d: 完了予定 / 完了 / 一時停止のカード。表示不要なら null。 */
function CompletionCard({ campaign }: { campaign: Campaign }) {
  if (campaign.status === "running" && campaign.estimatedCompletionAt) {
    const eta = formatEstimatedCompletion(campaign.estimatedCompletionAt);
    if (!eta) return null;
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-lg font-semibold text-indigo-900">完了予定: {eta}</p>
          <p className="text-sm text-indigo-700 tabular-nums">
            残り {campaign.stats.queued.toLocaleString()}通
            {campaign.stats.waitingFollowup > 0 &&
              ` + 追客待ち ${campaign.stats.waitingFollowup.toLocaleString()}件`}
          </p>
        </div>
        <p className="text-xs text-indigo-500 mt-1">送信間隔・時間帯設定に基づく目安です</p>
      </div>
    );
  }
  if (campaign.status === "completed" && campaign.completedAt) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-lg font-semibold text-blue-900">
          完了: {formatTimestamp(campaign.completedAt)}
        </p>
      </div>
    );
  }
  if (campaign.status === "paused") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-sm text-yellow-800">
          一時停止中 — 再開すると完了予定が再計算されます
        </p>
      </div>
    );
  }
  return null;
}

/** Phase 27b: 受信者テーブルの 開封/クリック/返信 コンパクト表示セル。 */
function EngagementMark({ at }: { at?: string }) {
  if (!at) {
    return <span className="text-gray-300">-</span>;
  }
  return (
    <span title={formatTimestamp(at)} className="inline-flex">
      <FiCheck className="w-4 h-4 text-green-600" />
    </span>
  );
}

export default function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { campaign_id: campaignId } = use(params);
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.user?.accessToken);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [timeseries, setTimeseries] = useState<CampaignDailyStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [recipientPage, setRecipientPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [isRequeueing, setIsRequeueing] = useState(false);
  // イベント履歴ダイアログの対象受信者 (null = 閉)
  const [eventRecipient, setEventRecipient] = useState<CampaignRecipient | null>(null);

  // テスト送信
  const [testTo, setTestTo] = useState("");
  const [testMailboxId, setTestMailboxId] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  // mailbox ID → アドレス表示用
  const [mailboxLabels, setMailboxLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!accessToken) return;
    const load = async () => {
      try {
        const response = await fetch(
          `${API_URL}/mailbox.v1.MailboxService/ListMailboxes`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          },
        );
        if (!response.ok) return;
        const data = await response.json();
        const labels: Record<string, string> = {};
        for (const m of data.mailboxes ?? []) {
          if (m?.id) labels[m.id] = m.address ?? m.id;
        }
        setMailboxLabels(labels);
      } catch {
        /* ラベルが ID 表示になるだけ */
      }
    };
    void load();
  }, [accessToken]);

  const callApi = useCallback(
    async (method: string, payload: Record<string, unknown>) => {
      const response = await fetch(
        `${API_URL}/campaign.v1.CampaignService/${method}`,
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
      return response.json();
    },
    [accessToken],
  );

  const fetchCampaign = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await callApi("GetCampaign", { id: campaignId });
      setCampaign(normalizeCampaign(data.campaign));
      setError(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`キャンペーンの取得に失敗しました: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, campaignId, callApi]);

  // Phase 27d: 日次時系列 (チャート + 「本日 N通」用)
  const fetchTimeseries = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await callApi("GetCampaignTimeseries", { campaignId });
      setTimeseries(
        (data.days ?? []).map((d: any) => normalizeDailyStat(d)),
      );
    } catch (e) {
      console.error("fetch timeseries failed", e);
    }
  }, [accessToken, campaignId, callApi]);

  useEffect(() => {
    void fetchCampaign();
    void fetchTimeseries();
  }, [fetchCampaign, fetchTimeseries]);

  // running 中は 15 秒ごとにポーリング (稼働インジケータを生きて見せる)
  useEffect(() => {
    if (campaign?.status !== "running") return;
    const timer = setInterval(() => {
      void fetchCampaign();
      void fetchTimeseries();
    }, 15_000);
    return () => clearInterval(timer);
  }, [campaign?.status, fetchCampaign, fetchTimeseries]);

  const fetchRecipients = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingRecipients(true);
    try {
      const payload: Record<string, unknown> = {
        campaignId,
        limit: PAGE_SIZE,
        offset: recipientPage * PAGE_SIZE,
      };
      if (statusFilter) payload.status = statusFilter;
      const data = await callApi("ListCampaignRecipients", payload);
      setRecipients(
        (data.recipients ?? []).map((r: any) => normalizeRecipient(r)),
      );
      setRecipientTotal(Number(data.total ?? 0));
    } catch (e) {
      console.error("fetch recipients failed", e);
    } finally {
      setIsLoadingRecipients(false);
    }
  }, [accessToken, campaignId, recipientPage, statusFilter, callApi]);

  useEffect(() => {
    void fetchRecipients();
  }, [fetchRecipients]);

  // フィルタ変更でページリセット
  useEffect(() => {
    setRecipientPage(0);
  }, [statusFilter]);

  const doAction = async (method: "StartCampaign" | "PauseCampaign" | "CancelCampaign") => {
    if (!accessToken || isActing) return;
    if (method === "CancelCampaign") {
      if (!window.confirm("このキャンペーンを中止しますか?\n中止すると再開できません。")) {
        return;
      }
    }
    setIsActing(true);
    setActionError(null);
    try {
      const data = await callApi(method, { id: campaignId });
      setCampaign(normalizeCampaign(data.campaign));
      void fetchRecipients();
    } catch (e: unknown) {
      // StartCampaign は特電法フィールド/件名/本文が空だと failed_precondition。
      // backend の日本語メッセージをそのまま表示する。
      const message = e instanceof Error ? e.message : "unknown error";
      setActionError(message);
    } finally {
      setIsActing(false);
    }
  };

  const handleRequeue = async () => {
    if (!accessToken || isRequeueing) return;
    setIsRequeueing(true);
    setActionError(null);
    try {
      const data = await callApi("RequeueFailedRecipients", { campaignId });
      const requeued = Number(data.requeued ?? 0);
      setActionError(null);
      window.alert(`${requeued} 件を再キューしました`);
      void fetchCampaign();
      void fetchRecipients();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setActionError(`再キューに失敗しました: ${message}`);
    } finally {
      setIsRequeueing(false);
    }
  };

  const handleSendTest = async () => {
    if (!accessToken || !testTo.trim() || !testMailboxId || isSendingTest) return;
    setIsSendingTest(true);
    setTestResult(null);
    try {
      await callApi("SendTestEmail", {
        campaignId,
        to: testTo.trim(),
        mailboxId: testMailboxId,
      });
      setTestResult(`${testTo.trim()} にテスト送信しました`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setTestResult(`テスト送信に失敗しました: ${message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  const stats = campaign?.stats;
  const openRate = stats && stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : null;
  const replyRate = stats && stats.sent > 0 ? ((stats.replied / stats.sent) * 100).toFixed(1) : null;

  // Phase 27e: フォローアップ設定の有無 (0 件なら従来と同一表示)
  const hasFollowups = (campaign?.followups.length ?? 0) > 0;

  const statCards = useMemo(() => {
    if (!stats) return [];
    const cards: { label: string; value: string; sub?: string }[] = [
      // Phase 27e: sent = 1通以上送った人数 (接触済み)
      { label: "接触済み", value: `${stats.sent.toLocaleString()} / ${stats.total.toLocaleString()}` },
      { label: "開封", value: stats.opened.toLocaleString(), sub: openRate ? `${openRate}%` : undefined },
      { label: "クリック", value: stats.clicked.toLocaleString() },
      { label: "返信", value: stats.replied.toLocaleString(), sub: replyRate ? `${replyRate}%` : undefined },
      { label: "バウンス", value: stats.bounced.toLocaleString() },
      { label: "配信停止", value: stats.unsubscribed.toLocaleString() },
    ];
    if (hasFollowups) {
      // 接触済みの隣 (2 番目) に追客待ちを差し込む
      cards.splice(1, 0, {
        label: "追客待ち",
        value: stats.waitingFollowup.toLocaleString(),
      });
    }
    return cards;
  }, [stats, openRate, replyRate, hasFollowups]);

  // Phase 27d: 欠損日を 0 埋めしたチャート用データと当日 (JST) の送信数
  const filledDays = useMemo(() => fillDailyStats(timeseries), [timeseries]);
  const todaySent = useMemo(() => {
    const today = jstDateString();
    return timeseries.find((d) => d.date === today)?.sent ?? 0;
  }, [timeseries]);

  // テスト送信のデフォルト mailbox
  useEffect(() => {
    if (campaign && !testMailboxId && campaign.mailboxIds.length > 0) {
      setTestMailboxId(campaign.mailboxIds[0]);
    }
  }, [campaign, testMailboxId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-red-500">{error ?? "キャンペーンが見つかりません"}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/campaigns")}>
            <FiArrowLeft className="w-4 h-4 mr-2" />
            一覧に戻る
          </Button>
        </div>
      </div>
    );
  }

  const canTestSend = ["draft", "running", "paused"].includes(campaign.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ヘッダー */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/campaigns")}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            title="キャンペーン一覧へ"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <CampaignStatusBadge status={campaign.status} />
          {campaign.status === "running" && (
            <RunningIndicator campaign={campaign} todaySent={todaySent} />
          )}
          <div className="flex-1" />
          <div className="flex gap-2">
            {campaign.status === "draft" && (
              <Button
                onClick={() => doAction("StartCampaign")}
                disabled={isActing}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
              >
                <FiPlay className="w-4 h-4 mr-2" />
                開始
              </Button>
            )}
            {campaign.status === "running" && (
              <Button variant="outline" onClick={() => doAction("PauseCampaign")} disabled={isActing}>
                <FiPause className="w-4 h-4 mr-2" />
                一時停止
              </Button>
            )}
            {campaign.status === "paused" && (
              <Button
                onClick={() => doAction("StartCampaign")}
                disabled={isActing}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
              >
                <FiPlay className="w-4 h-4 mr-2" />
                再開
              </Button>
            )}
            {(campaign.status === "running" || campaign.status === "paused") && (
              <Button
                variant="outline"
                onClick={() => doAction("CancelCampaign")}
                disabled={isActing}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <FiXCircle className="w-4 h-4 mr-2" />
                中止
              </Button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{actionError}</p>
          </div>
        )}

        {/* Phase 27d: 完了予定 / 完了 / 一時停止 */}
        <CompletionCard campaign={campaign} />

        {/* 統計カード */}
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${
            statCards.length > 6 ? "lg:grid-cols-7" : "lg:grid-cols-6"
          }`}
        >
          {statCards.map((card) => (
            <div key={card.label} className="bg-white border rounded-xl p-4">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums mt-1">
                {card.value}
                {card.sub && (
                  <span className="text-sm font-medium text-gray-500 ml-1">({card.sub})</span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Phase 27d: 日次折れ線チャート (+ 折りたたみのファネル) */}
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">日次推移</p>
          <CampaignChart days={filledDays} />
          <p className="text-xs text-gray-500 mt-2">
            ※ 開封率は目安です (画像ブロックなどの影響でブレます)
          </p>
          {stats && (
            <details className="mt-3 pt-3 border-t">
              <summary className="text-sm text-gray-600 cursor-pointer select-none hover:text-gray-900">
                エンゲージメントファネル (バウンス・配信停止を含む)
              </summary>
              <div className="mt-2">
                <EngagementFunnel stats={stats} />
              </div>
            </details>
          )}
        </div>

        {/* 設定サマリー */}
        <div className="bg-white border rounded-xl p-4 text-sm text-gray-700 flex flex-wrap gap-x-6 gap-y-1">
          {hasFollowups && (
            <span className="w-full flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-gray-500">シーケンス:</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                1通目
              </span>
              {campaign.followups.map((f) => (
                <span key={f.stepNo} className="flex items-center gap-1.5">
                  <span className="text-gray-400">→</span>
                  <span
                    className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium"
                    title={`${f.stepNo}通目: 前の送信から${f.waitDays}日後、返信がなければ送信`}
                  >
                    +{f.waitDays}日
                  </span>
                </span>
              ))}
              <span className="text-xs text-gray-400 ml-1">
                (返信・配信停止・バウンスで自動停止)
              </span>
            </span>
          )}
          <span>
            送信時間帯: {campaign.schedule.sendStartHour}時〜{campaign.schedule.sendEndHour}時 / {formatSendDays(campaign.schedule.sendDays)}
          </span>
          <span>日次上限: {campaign.schedule.dailyCapPerMailbox} 通/mailbox</span>
          <span>間隔: {campaign.schedule.minIntervalSec} 秒</span>
          <span>ウォームアップ: {campaign.schedule.warmupEnabled ? "あり" : "なし"}</span>
          <span>作成: {formatTimestamp(campaign.createdAt)}</span>
          {campaign.startedAt && <span>開始: {formatTimestamp(campaign.startedAt)}</span>}
          {campaign.completedAt && <span>完了: {formatTimestamp(campaign.completedAt)}</span>}
        </div>

        {/* テスト送信 */}
        {canTestSend && (
          <div className="bg-white border rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiMail className="w-4 h-4 text-blue-600" />
              テスト送信 (フッター込みのレンダリング結果を確認できます)
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="test@example.com"
                className="max-w-xs"
                disabled={isSendingTest}
              />
              {campaign.mailboxIds.length > 1 && (
                <select
                  aria-label="テスト送信元メールボックス"
                  value={testMailboxId}
                  onChange={(e) => setTestMailboxId(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                  disabled={isSendingTest}
                >
                  {campaign.mailboxIds.map((id) => (
                    <option key={id} value={id}>
                      {mailboxLabels[id] ?? id}
                    </option>
                  ))}
                </select>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendTest}
                disabled={isSendingTest || !testTo.trim() || !testMailboxId}
              >
                {isSendingTest ? "送信中..." : "テスト送信"}
              </Button>
            </div>
            {testResult && (
              <p
                className={`text-sm ${testResult.includes("失敗") ? "text-red-600" : "text-green-600"}`}
              >
                {testResult}
              </p>
            )}
          </div>
        )}

        {/* 受信者一覧 */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">受信者</h2>
            <div className="flex gap-1 ml-2">
              {RECIPIENT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    statusFilter === tab.key
                      ? "bg-blue-600 text-white font-medium"
                      : "bg-white border text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {statusFilter === "failed" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRequeue}
                disabled={isRequeueing}
              >
                <FiRefreshCw className={`w-4 h-4 mr-1 ${isRequeueing ? "animate-spin" : ""}`} />
                失敗分を再キュー
              </Button>
            )}
          </div>

          <div className="border rounded-2xl overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">顧客名</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">メール</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">ステータス</TableHead>
                  {hasFollowups && (
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">ステップ</TableHead>
                  )}
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">送信日時</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider text-center">開封</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider text-center">クリック</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider text-center">返信</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">エラー</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingRecipients ? (
                  <TableRow>
                    <TableCell colSpan={hasFollowups ? 9 : 8} className="text-center py-8 text-gray-500">
                      読み込み中...
                    </TableCell>
                  </TableRow>
                ) : recipients.length > 0 ? (
                  recipients.map((r) => (
                    <TableRow
                      key={r.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setEventRecipient(r)}
                      title="クリックでイベント履歴を表示"
                    >
                      <TableCell>
                        <div className="font-medium text-gray-900">{r.customerName || "(名前なし)"}</div>
                        {r.customerCorporation && (
                          <div className="text-xs text-gray-500">{r.customerCorporation}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{r.email || "-"}</TableCell>
                      <TableCell>
                        <RecipientStatusBadge status={r.status} />
                      </TableCell>
                      {hasFollowups && (
                        <TableCell>
                          {r.sentAt ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium whitespace-nowrap">
                              {r.currentStep}通目
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                          {r.status === "queued" && r.nextStepAt && (
                            <p className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                              {formatTimestamp(r.nextStepAt)} に{r.currentStep + 1}通目
                            </p>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-sm text-gray-500">
                        {formatTimestamp(r.sentAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        <EngagementMark at={r.firstOpenedAt} />
                      </TableCell>
                      <TableCell className="text-center">
                        <EngagementMark at={r.firstClickedAt} />
                      </TableCell>
                      <TableCell className="text-center">
                        <EngagementMark at={r.repliedAt} />
                      </TableCell>
                      <TableCell className="text-sm text-red-600 max-w-xs truncate" title={r.error}>
                        {r.error || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={hasFollowups ? 9 : 8} className="text-center py-8 text-gray-500">
                      該当する受信者がいません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* ページネーション */}
          {recipientTotal > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {recipientTotal} 件中 {recipientPage * PAGE_SIZE + 1}〜
                {Math.min((recipientPage + 1) * PAGE_SIZE, recipientTotal)} 件
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientPage((p) => Math.max(0, p - 1))}
                  disabled={recipientPage === 0}
                  className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← 前へ
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-700">
                  {recipientPage + 1} / {Math.ceil(recipientTotal / PAGE_SIZE)}
                </span>
                <button
                  type="button"
                  onClick={() => setRecipientPage((p) => p + 1)}
                  disabled={(recipientPage + 1) * PAGE_SIZE >= recipientTotal}
                  className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  次へ →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase 27b: 受信者イベント履歴ダイアログ */}
      <RecipientEventsDialog
        recipient={eventRecipient}
        accessToken={accessToken}
        onClose={() => setEventRecipient(null)}
      />
    </div>
  );
}
