"use client";

// ActivityHistoryCard は顧客との全やりとりを一本化した履歴カード。
// 扱うのは 4 種類 (旧 CallManagementCard の後継):
//   - call          (コール履歴)
//   - email_sent    (CRM 送信メール)
//   - email_received (IMAP 取込み — 将来スコープ)
//   - redial        (掛け直し予定) ← Phase 20c で RedialCard から統合
//
// ToggleGroup で「全て / コール / メール / 掛け直し」を切替。
// 掛け直し予定は未来の日付なので「全て」選択時は時系列降順で自然に先頭に並ぶ。
//
// 前回の教訓を踏まえた実装ルール:
//   - useEffect deps は primitive のみ (accessToken / customerId / filter)
//   - auth オブジェクトや user オブジェクトを deps に入れない
//   - shadcn CardTitle は <div> なので E2E は getByText で取得する想定

import {
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  useMemo,
  forwardRef,
  useRef,
} from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuthStore } from "@/store/authStore";
import {
  FiPhone,
  FiMail,
  FiCalendar,
  FiEdit2,
  FiTrash2,
  FiRefreshCw,
  FiAlertTriangle,
  FiPlus,
  FiPlayCircle,
} from "react-icons/fi";
import { PhoneLink } from "@/components/ui/phone-input";
import { RedialEditDialog, type RedialDraft, type RedialSyncStatus } from "./RedialEditDialog";
import { EmailDetailDialog } from "./EmailDetailDialog";
import { RecordingPlayDialog } from "./RecordingPlayDialog";

export type ActivityFilter = "all" | "call" | "email" | "redial";

interface Activity {
  id: string;
  customerId: string;
  type: "call" | "email_sent" | "email_received" | "unspecified";
  userId: string;
  userName: string;
  statusId?: string;
  statusName?: string;
  statusEffective?: boolean;
  statusNg?: boolean;
  phone?: string;
  mailFrom?: string;
  mailTo?: string;
  mailCc?: string;
  subject?: string;
  body?: string;
  occurredAt: string;
  // Phase 22: Zoom Phone 通話録音メタ。recording 実体は s3:// で別途保存され、
  // 再生 URL は GetActivityRecording RPC で短命 signed URL を取りに行く。
  hasRecording?: boolean;
  durationSeconds?: number;
}

interface Redial {
  id: string;
  customerId: string;
  userId: string;
  userName: string;
  phone: string;
  startAt: string;
  endAt: string;
  note: string;
  gcalEventId?: string;
  syncStatus: RedialSyncStatus;
}

/**
 * 統合 timeline の行。activity と redial を区別する discriminated union。
 */
type TimelineItem =
  | { kind: "activity"; date: string; payload: Activity }
  | { kind: "redial"; date: string; payload: Redial };

interface Status {
  id: string;
  bookId: string;
  priority: number;
  name: string;
  effective: boolean;
  ng: boolean;
}

interface ActivityHistoryCardProps {
  customerId: string;
  bookId: string;
  customerPhone?: string;
  onActivityCreated?: () => void;
  onSendEmailClick?: () => void;
}

export interface ActivityHistoryCardRef {
  refreshActivities: () => void;
}

const PROTO_TYPE_TO_STRING: Record<number, Activity["type"]> = {
  0: "unspecified",
  1: "call",
  2: "email_sent",
  3: "email_received",
};

function normalizeActivity(raw: any): Activity {
  let type: Activity["type"] = "unspecified";
  if (typeof raw.type === "number") {
    type = PROTO_TYPE_TO_STRING[raw.type] ?? "unspecified";
  } else if (typeof raw.type === "string") {
    if (raw.type === "ACTIVITY_TYPE_CALL") type = "call";
    else if (raw.type === "ACTIVITY_TYPE_EMAIL_SENT") type = "email_sent";
    else if (raw.type === "ACTIVITY_TYPE_EMAIL_RECEIVED") type = "email_received";
  }

  return {
    id: raw.id ?? "",
    customerId: raw.customerId ?? raw.customer_id ?? "",
    type,
    userId: raw.userId ?? raw.user_id ?? "",
    userName: raw.userName ?? raw.user_name ?? "",
    statusId: raw.statusId ?? raw.status_id,
    statusName: raw.statusName ?? raw.status_name,
    statusEffective: raw.statusEffective ?? raw.status_effective,
    statusNg: raw.statusNg ?? raw.status_ng,
    phone: raw.phone,
    mailFrom: raw.mailFrom ?? raw.mail_from,
    mailTo: raw.mailTo ?? raw.mail_to,
    mailCc: raw.mailCc ?? raw.mail_cc,
    subject: raw.subject,
    body: raw.body,
    occurredAt: raw.occurredAt ?? raw.occurred_at ?? "",
    hasRecording: raw.hasRecording ?? raw.has_recording ?? false,
    durationSeconds: raw.durationSeconds ?? raw.duration_seconds,
  };
}

function normalizeRedialSyncStatus(raw: unknown): RedialSyncStatus {
  if (raw === "SYNC_STATUS_SYNCED" || raw === 1) return "synced";
  if (raw === "SYNC_STATUS_UNSYNCED" || raw === 2) return "unsynced";
  if (raw === "SYNC_STATUS_NOT_CONNECTED" || raw === 3) return "not_connected";
  return "unspecified";
}

function normalizeRedial(raw: any): Redial {
  return {
    id: raw?.id ?? "",
    customerId: raw?.customerId ?? raw?.customer_id ?? "",
    userId: raw?.userId ?? raw?.user_id ?? "",
    userName: raw?.userName ?? raw?.user_name ?? "",
    phone: raw?.phone ?? "",
    startAt: raw?.startAt ?? raw?.start_at ?? "",
    endAt: raw?.endAt ?? raw?.end_at ?? "",
    note: raw?.note ?? "",
    gcalEventId: raw?.gcalEventId ?? raw?.gcal_event_id ?? undefined,
    syncStatus: normalizeRedialSyncStatus(raw?.syncStatus ?? raw?.sync_status),
  };
}

const ActivityHistoryCard = forwardRef<ActivityHistoryCardRef, ActivityHistoryCardProps>(
  ({ customerId, bookId, customerPhone, onActivityCreated, onSendEmailClick }, ref) => {
    const accessToken = useAuthStore((s) => s.user?.accessToken);

    const [activities, setActivities] = useState<Activity[]>([]);
    const [redials, setRedials] = useState<Redial[]>([]);
    const [statuses, setStatuses] = useState<Status[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingActivityId, setUpdatingActivityId] = useState<string | null>(null);
    const [filter, setFilter] = useState<ActivityFilter>("all");

    // Redial 編集 dialog
    const [redialEditOpen, setRedialEditOpen] = useState(false);
    const [editingRedial, setEditingRedial] = useState<RedialDraft | null>(null);

    // メール詳細 dialog
    const [emailDetailOpen, setEmailDetailOpen] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState<Activity | null>(null);

    // 録音再生 dialog (Phase 22b)
    const [recordingOpen, setRecordingOpen] = useState(false);
    const [recordingActivity, setRecordingActivity] = useState<Activity | null>(null);

    // 直近の fetch を ref に保存し、useImperativeHandle から安定して呼ぶ。
    const fetchAllRef = useRef<() => Promise<void>>(() => Promise.resolve());

    // activities と redials を並列で fetch。client-side で filter 適用するので
    // backend には types[] を絞って送らず、一度取得してキャッシュする。
    const fetchAll = useCallback(async () => {
      if (!accessToken || !customerId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
        const [actRes, redRes] = await Promise.all([
          fetch(`${apiUrl}/activity.v1.ActivityService/ListActivitiesByCustomerID`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ customer_id: customerId, types: [] }),
          }),
          fetch(`${apiUrl}/redial.v1.RedialService/ListRedialsByCustomer`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ customer_id: customerId }),
          }),
        ]);

        if (!actRes.ok) {
          const text = await actRes.text();
          throw new Error(`活動履歴の取得に失敗しました: ${text}`);
        }
        const actData = await actRes.json();
        setActivities((actData.activities ?? []).map(normalizeActivity));

        if (redRes.ok) {
          const redData = await redRes.json();
          setRedials((redData.redials ?? []).map(normalizeRedial));
        } else {
          // 失敗しても致命的ではない — 活動履歴だけ表示する
          console.warn("ListRedialsByCustomer failed", await redRes.text());
          setRedials([]);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown error";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    }, [accessToken, customerId]);

    fetchAllRef.current = fetchAll;

    useImperativeHandle(
      ref,
      () => ({
        refreshActivities: () => {
          void fetchAllRef.current();
        },
      }),
      [],
    );

    const fetchStatuses = useCallback(async () => {
      if (!accessToken || !bookId) return;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
        const response = await fetch(`${apiUrl}/status.v1.StatusService/ListStatuses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ book_id: bookId }),
        });
        if (!response.ok) return;
        const data = await response.json();
        const statusList = (data.statuses || []).map((s: any) => ({
          id: s.id,
          bookId: s.book_id || s.bookId,
          priority: s.priority,
          name: s.name,
          effective: s.effective,
          ng: s.ng,
        }));
        setStatuses(statusList);
      } catch (e) {
        console.error("fetch statuses error", e);
      }
    }, [accessToken, bookId]);

    useEffect(() => {
      void fetchAll();
    }, [fetchAll]);

    useEffect(() => {
      void fetchStatuses();
    }, [fetchStatuses]);

    // filter + マージ + ソート
    const timelineItems: TimelineItem[] = useMemo(() => {
      const items: TimelineItem[] = [];

      const wantActivity =
        filter === "all" || filter === "call" || filter === "email";
      const wantRedial = filter === "all" || filter === "redial";

      if (wantActivity) {
        for (const a of activities) {
          if (filter === "call" && a.type !== "call") continue;
          if (filter === "email" && a.type !== "email_sent" && a.type !== "email_received") continue;
          items.push({ kind: "activity", date: a.occurredAt, payload: a });
        }
      }
      if (wantRedial) {
        for (const r of redials) {
          items.push({ kind: "redial", date: r.startAt, payload: r });
        }
      }

      // 日付降順 (未来 → 現在 → 過去)。未来の掛け直しが自然に先頭に並ぶ。
      items.sort((x, y) => {
        const xt = x.date ? new Date(x.date).getTime() : 0;
        const yt = y.date ? new Date(y.date).getTime() : 0;
        return yt - xt;
      });
      return items;
    }, [activities, redials, filter]);

    // Google 未連携の redial があるかどうか (バナー表示条件)
    const hasNotConnectedRedial = useMemo(
      () =>
        (filter === "all" || filter === "redial") &&
        redials.some((r) => r.syncStatus === "not_connected"),
      [redials, filter],
    );

    const handleUpdateActivityStatus = async (activityId: string, newStatusId: string) => {
      if (!accessToken) return;
      setUpdatingActivityId(activityId);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
        const response = await fetch(`${apiUrl}/activity.v1.ActivityService/UpdateActivityStatus`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: activityId, status_id: newStatusId }),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`ステータス更新に失敗しました: ${text}`);
        }
        const updatedStatus = statuses.find((s) => s.id === newStatusId);
        if (updatedStatus) {
          setActivities((prev) =>
            prev.map((a) =>
              a.id === activityId
                ? {
                    ...a,
                    statusId: newStatusId,
                    statusName: updatedStatus.name,
                    statusEffective: updatedStatus.effective,
                    statusNg: updatedStatus.ng,
                  }
                : a,
            ),
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "unknown error";
        setError(msg);
      } finally {
        setUpdatingActivityId(null);
      }
    };

    const handleNewRedial = () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 15);
      setEditingRedial({
        id: "",
        customerId,
        phone: customerPhone ?? "",
        startAt: now.toISOString(),
        endAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        note: "",
      });
      setRedialEditOpen(true);
    };

    const handleEditRedial = (r: Redial) => {
      setEditingRedial({
        id: r.id,
        customerId: r.customerId,
        phone: r.phone,
        startAt: r.startAt,
        endAt: r.endAt,
        note: r.note,
      });
      setRedialEditOpen(true);
    };

    const handleDeleteRedial = async (r: Redial) => {
      if (!accessToken) return;
      if (!confirm(`${formatDateTimeInline(r.startAt)} の予定を削除します。よろしいですか？`)) {
        return;
      }
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
        const res = await fetch(`${apiUrl}/redial.v1.RedialService/DeleteRedial`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: r.id }),
        });
        if (!res.ok) throw new Error(await res.text());
        await fetchAll();
      } catch (e) {
        setError(e instanceof Error ? e.message : "unknown error");
      }
    };

    const handleResyncRedial = async (r: Redial) => {
      if (!accessToken) return;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
        const res = await fetch(`${apiUrl}/redial.v1.RedialService/ResyncRedial`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: r.id }),
        });
        if (!res.ok) throw new Error(await res.text());
        await fetchAll();
      } catch (e) {
        setError(e instanceof Error ? e.message : "unknown error");
      }
    };

    const formatDateTime = (dateString: string) => {
      if (!dateString) return { date: "-", time: "-" };
      const d = new Date(dateString);
      return {
        date: d.toLocaleDateString("ja-JP"),
        time: d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
      };
    };

    const getStatusBadgeStyle = (status: { effective?: boolean; ng?: boolean }) => {
      if (status.ng) return "bg-red-100 text-red-800";
      if (status.effective) return "bg-green-100 text-green-800";
      return "bg-blue-100 text-blue-800";
    };

    return (
      <>
        <Card className="border border-gray-200 bg-white rounded-2xl shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <h2 className="text-base font-semibold text-gray-900">活動履歴</h2>
              <div className="flex gap-2 items-center">
                <ToggleGroup
                  type="single"
                  value={filter}
                  onValueChange={(v) => {
                    if (v === "all" || v === "call" || v === "email" || v === "redial") {
                      setFilter(v);
                    }
                  }}
                  size="sm"
                >
                  <ToggleGroupItem value="all" aria-label="全て">
                    全て
                  </ToggleGroupItem>
                  <ToggleGroupItem value="call" aria-label="コール">
                    コール
                  </ToggleGroupItem>
                  <ToggleGroupItem value="email" aria-label="メール">
                    メール
                  </ToggleGroupItem>
                  <ToggleGroupItem value="redial" aria-label="掛け直し">
                    掛け直し
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSendEmailClick?.()}
                >
                  <FiMail className="w-4 h-4 mr-1" />
                  メール送信
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleNewRedial}
                  aria-label="新規予約"
                >
                  <FiPlus className="w-4 h-4 mr-1" />
                  新規予約
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

            {hasNotConnectedRedial && (
              <div className="flex items-center gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                <FiAlertTriangle className="w-4 h-4" />
                <span>Google 未連携のためカレンダー同期されていません</span>
                <Link href="/settings" className="ml-2 underline text-blue-600">
                  設定で連携
                </Link>
              </div>
            )}

            <div className="border rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-gray-50 border-b">
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">日付</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">時刻</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">種別</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">内容</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">担当者</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        読み込み中...
                      </TableCell>
                    </TableRow>
                  ) : timelineItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        履歴がありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    timelineItems.map((item) => {
                      if (item.kind === "activity") {
                        return renderActivityRow({
                          a: item.payload,
                          statuses,
                          updatingActivityId,
                          customerId,
                          bookId,
                          getStatusBadgeStyle,
                          formatDateTime,
                          onStatusChange: handleUpdateActivityStatus,
                          onCallCreated: () => {
                            void fetchAll();
                            onActivityCreated?.();
                          },
                          onEmailClick: (a) => {
                            setSelectedEmail(a);
                            setEmailDetailOpen(true);
                          },
                          onPlayRecording: (a) => {
                            setRecordingActivity(a);
                            setRecordingOpen(true);
                          },
                        });
                      }
                      return renderRedialRow({
                        r: item.payload,
                        formatDateTime,
                        onEdit: handleEditRedial,
                        onDelete: handleDeleteRedial,
                        onResync: handleResyncRedial,
                      });
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <RedialEditDialog
          open={redialEditOpen}
          onOpenChange={setRedialEditOpen}
          initial={editingRedial}
          onSaved={() => {
            setRedialEditOpen(false);
            void fetchAll();
          }}
        />

        <EmailDetailDialog
          open={emailDetailOpen}
          onOpenChange={setEmailDetailOpen}
          email={
            selectedEmail && (selectedEmail.type === "email_sent" || selectedEmail.type === "email_received")
              ? {
                  type: selectedEmail.type,
                  subject: selectedEmail.subject,
                  body: selectedEmail.body,
                  mailFrom: selectedEmail.mailFrom,
                  mailTo: selectedEmail.mailTo,
                  mailCc: selectedEmail.mailCc,
                  userName: selectedEmail.userName,
                  occurredAt: selectedEmail.occurredAt,
                }
              : null
          }
        />

        <RecordingPlayDialog
          open={recordingOpen}
          onOpenChange={setRecordingOpen}
          activityId={recordingActivity?.id ?? null}
          accessToken={accessToken}
          occurredAt={recordingActivity?.occurredAt ?? ""}
          durationSeconds={recordingActivity?.durationSeconds}
        />
      </>
    );
  },
);

ActivityHistoryCard.displayName = "ActivityHistoryCard";

export default ActivityHistoryCard;

/**
 * inline 日時整形 (行レンダラーが parent state に依存しないように local 関数)。
 */
function formatDateTimeInline(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("ja-JP")} ${d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
}

// ---- 行レンダラ (ActivityHistoryCard の body を肥大化させないために分離) ----

function renderActivityRow(args: {
  a: Activity;
  statuses: Status[];
  updatingActivityId: string | null;
  customerId: string;
  bookId: string;
  getStatusBadgeStyle: (s: { effective?: boolean; ng?: boolean }) => string;
  formatDateTime: (iso: string) => { date: string; time: string };
  onStatusChange: (activityId: string, newStatusId: string) => void;
  onCallCreated: () => void;
  onEmailClick?: (a: Activity) => void;
  onPlayRecording?: (a: Activity) => void;
}) {
  const {
    a,
    statuses,
    updatingActivityId,
    customerId,
    bookId,
    getStatusBadgeStyle,
    formatDateTime,
    onStatusChange,
    onCallCreated,
    onEmailClick,
    onPlayRecording,
  } = args;
  const { date, time } = formatDateTime(a.occurredAt);
  const isCall = a.type === "call";
  const isEmailSent = a.type === "email_sent";
  const isEmailRecv = a.type === "email_received";
  const isEmail = isEmailSent || isEmailRecv;
  return (
    <TableRow
      key={`act-${a.id}`}
      className={isEmail ? "hover:bg-blue-50 cursor-pointer" : "hover:bg-gray-50"}
      onClick={isEmail ? () => onEmailClick?.(a) : undefined}
    >
      <TableCell className="font-medium whitespace-nowrap">{date}</TableCell>
      <TableCell className="whitespace-nowrap">{time}</TableCell>
      <TableCell>
        {isCall && (
          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
            <FiPhone className="w-3 h-3" />
            コール
          </span>
        )}
        {isEmailSent && (
          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
            <FiMail className="w-3 h-3" />
            送信
          </span>
        )}
        {isEmailRecv && (
          <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
            <FiMail className="w-3 h-3" />
            受信
          </span>
        )}
      </TableCell>
      <TableCell className="max-w-md">
        {isCall ? (
          <div className="flex items-center gap-2">
            <PhoneLink
              phone={a.phone ?? ""}
              customerId={customerId}
              bookId={bookId}
              onCallCreated={onCallCreated}
            />
            {a.hasRecording && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayRecording?.(a);
                }}
                title="通話録音を再生"
                className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800"
                data-testid="recording-play-button"
              >
                <FiPlayCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        ) : (
          <div className="truncate">
            <div className="font-medium text-gray-900 truncate">{a.subject || "(件名なし)"}</div>
            <div className="text-xs text-gray-500 truncate">
              {isEmailSent ? `→ ${a.mailTo}` : `← ${a.mailFrom}`}
            </div>
          </div>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">{a.userName || "-"}</TableCell>
      <TableCell>
        {isCall && a.statusId ? (
          <Select
            value={a.statusId}
            onValueChange={(newStatusId) => onStatusChange(a.id, newStatusId)}
            disabled={updatingActivityId === a.id}
          >
            <SelectTrigger
              className={`w-32 h-8 ${getStatusBadgeStyle({
                effective: a.statusEffective,
                ng: a.statusNg,
              })}`}
            >
              <SelectValue>{a.statusName ?? "-"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  <span
                    className={getStatusBadgeStyle({
                      effective: status.effective,
                      ng: status.ng,
                    })}
                  >
                    {status.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function renderRedialRow(args: {
  r: Redial;
  formatDateTime: (iso: string) => { date: string; time: string };
  onEdit: (r: Redial) => void;
  onDelete: (r: Redial) => void;
  onResync: (r: Redial) => void;
}) {
  const { r, formatDateTime, onEdit, onDelete, onResync } = args;
  const { date, time } = formatDateTime(r.startAt);
  const isFuture = r.startAt ? new Date(r.startAt).getTime() > Date.now() : false;
  return (
    <TableRow
      key={`red-${r.id}`}
      className={isFuture ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"}
    >
      <TableCell className="font-medium whitespace-nowrap">{date}</TableCell>
      <TableCell className="whitespace-nowrap">{time}</TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
          <FiCalendar className="w-3 h-3" />
          掛け直し
        </span>
      </TableCell>
      <TableCell className="max-w-md">
        <div className="truncate text-gray-700">{r.note || "(メモなし)"}</div>
        {r.phone && <div className="text-xs text-gray-500 truncate">電話: {r.phone}</div>}
      </TableCell>
      <TableCell className="whitespace-nowrap">{r.userName || r.userId || "-"}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <RedialSyncBadge status={r.syncStatus} />
          {r.syncStatus === "unsynced" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="再同期"
              onClick={() => onResync(r)}
            >
              <FiRefreshCw className="w-4 h-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="予定を編集"
            onClick={() => onEdit(r)}
          >
            <FiEdit2 className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="予定を削除"
            onClick={() => onDelete(r)}
          >
            <FiTrash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RedialSyncBadge({ status }: { status: RedialSyncStatus }) {
  const base = "inline-block px-2 py-0.5 rounded-full text-xs font-medium";
  if (status === "synced") {
    return <span className={`${base} bg-green-100 text-green-800`}>同期済</span>;
  }
  if (status === "unsynced") {
    return <span className={`${base} bg-yellow-100 text-yellow-800`}>未同期</span>;
  }
  if (status === "not_connected") {
    return <span className={`${base} bg-gray-100 text-gray-600`}>未連携</span>;
  }
  return <span className={`${base} bg-gray-100 text-gray-500`}>-</span>;
}
