// Activity 横断フィード / 集計画面で共有する型・正規化・期間ヘルパー。
// バックエンドは Connect-RPC (protojson) なので:
//   - レスポンスのフィールドは camelCase / snake_case 両対応で読む
//   - int64 は string で届くことがあるので Number() で正規化する
//   - Timestamp は RFC3339 文字列

export type ActivityType = "call" | "email_sent" | "email_received" | "unspecified";

export interface FeedActivity {
  id: string;
  customerId: string;
  customerName?: string;
  customerCorporation?: string;
  type: ActivityType;
  userId: string;
  userName: string;
  statusId?: string;
  statusName?: string;
  statusEffective?: boolean;
  statusNg?: boolean;
  phone?: string;
  mailFrom?: string;
  mailTo?: string;
  subject?: string;
  body?: string;
  occurredAt: string;
  hasRecording?: boolean;
  durationSeconds?: number;
}

const PROTO_TYPE_TO_STRING: Record<number, ActivityType> = {
  0: "unspecified",
  1: "call",
  2: "email_sent",
  3: "email_received",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeFeedActivity(raw: any): FeedActivity {
  let type: ActivityType = "unspecified";
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
    customerName: raw.customerName ?? raw.customer_name,
    customerCorporation: raw.customerCorporation ?? raw.customer_corporation,
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
    subject: raw.subject,
    body: raw.body,
    occurredAt: raw.occurredAt ?? raw.occurred_at ?? "",
    hasRecording: raw.hasRecording ?? raw.has_recording ?? false,
    durationSeconds:
      raw.durationSeconds != null
        ? Number(raw.durationSeconds)
        : raw.duration_seconds != null
          ? Number(raw.duration_seconds)
          : undefined,
  };
}

export interface CallStatsCell {
  userId: string;
  userName: string;
  statusId?: string;
  statusName?: string;
  statusPriority?: number;
  count: number;
  totalDurationSeconds: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCallStatsCell(raw: any): CallStatsCell {
  return {
    userId: raw.userId ?? raw.user_id ?? "",
    userName: raw.userName ?? raw.user_name ?? "",
    statusId: raw.statusId ?? raw.status_id,
    statusName: raw.statusName ?? raw.status_name,
    statusPriority:
      raw.statusPriority != null
        ? Number(raw.statusPriority)
        : raw.status_priority != null
          ? Number(raw.status_priority)
          : undefined,
    count: Number(raw.count ?? 0),
    totalDurationSeconds: Number(
      raw.totalDurationSeconds ?? raw.total_duration_seconds ?? 0,
    ),
  };
}

export interface MailStatsRow {
  userId: string;
  userName: string;
  sentCount: number;
  replyCount: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeMailStatsRow(raw: any): MailStatsRow {
  return {
    userId: raw.userId ?? raw.user_id ?? "",
    userName: raw.userName ?? raw.user_name ?? "",
    sentCount: Number(raw.sentCount ?? raw.sent_count ?? 0),
    replyCount: Number(raw.replyCount ?? raw.reply_count ?? 0),
  };
}

// ─── 期間 ───────────────────────────────────────────────────────

export type PeriodPreset = "today" | "week" | "month" | "all" | "custom";

export interface PeriodRange {
  // RFC3339。undefined は「無制限」
  from?: string;
  to?: string;
}

/**
 * プリセットを [from, to) の RFC3339 ペアに展開する。
 * 「今週」は月曜はじまり。custom は呼び出し側の date input 値を使う。
 */
export function presetToRange(
  preset: PeriodPreset,
  customFrom?: string,
  customTo?: string,
): PeriodRange {
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (preset) {
    case "today":
      return { from: startOfDay(now).toISOString() };
    case "week": {
      const d = startOfDay(now);
      const dow = (d.getDay() + 6) % 7; // 月曜=0
      d.setDate(d.getDate() - dow);
      return { from: d.toISOString() };
    }
    case "month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      };
    case "custom": {
      const r: PeriodRange = {};
      if (customFrom) r.from = new Date(customFrom + "T00:00:00").toISOString();
      if (customTo) {
        // to は exclusive なので翌日 0:00
        const t = new Date(customTo + "T00:00:00");
        t.setDate(t.getDate() + 1);
        r.to = t.toISOString();
      }
      return r;
    }
    case "all":
    default:
      return {};
  }
}

export function formatDateTime(iso: string): { date: string; time: string } {
  if (!iso) return { date: "-", time: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "-", time: "" };
  return {
    date: d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
  };
}

/** 秒数を「1時間23分」「45分」「30秒」形式に。0 や undefined は "-"。 */
export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分`;
  return `${s}秒`;
}
