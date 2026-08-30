// Phase 27a: campaign.v1.CampaignService の共有型・正規化ヘルパー。
// Connect JSON は snake_case / camelCase どちらでも返り得るので両対応で読む。

export interface CampaignSchedule {
  sendStartHour: number;
  sendEndHour: number;
  /** bitmask Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64。 */
  sendDays: number;
  dailyCapPerMailbox: number;
  minIntervalSec: number;
  warmupEnabled: boolean;
}

export interface CampaignSender {
  senderOrg: string;
  senderAddress: string;
  senderContact: string;
}

export interface CampaignStats {
  total: number;
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
}

export type CampaignStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "cancelled";

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  subject: string;
  body: string;
  trackOpens: boolean;
  trackClicks: boolean;
  schedule: CampaignSchedule;
  sender: CampaignSender;
  mailboxIds: string[];
  stats: CampaignStats;
  createdBy: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRecipient {
  id: string;
  customerId: string;
  customerName: string;
  customerCorporation: string;
  email: string;
  status: string; // queued|sending|sent|failed|skipped
  error: string;
  sentAt?: string;
  firstOpenedAt?: string;
  firstClickedAt?: string;
  repliedAt?: string;
  bouncedAt?: string;
  unsubscribedAt?: string;
}

export interface CampaignRecipientEvent {
  id: string;
  kind: string; // open|click|unsubscribe|reply|bounce
  url: string;
  userAgent: string;
  createdAt: string;
}

export interface Suppression {
  id: string;
  email: string;
  reason: string; // unsubscribe|hard_bounce|manual|complaint
  campaignId?: string;
  note: string;
  createdAt: string;
}

export function normalizeSchedule(raw: any): CampaignSchedule {
  return {
    sendStartHour: raw?.send_start_hour ?? raw?.sendStartHour ?? 9,
    sendEndHour: raw?.send_end_hour ?? raw?.sendEndHour ?? 18,
    sendDays: raw?.send_days ?? raw?.sendDays ?? 31,
    dailyCapPerMailbox: raw?.daily_cap_per_mailbox ?? raw?.dailyCapPerMailbox ?? 100,
    minIntervalSec: raw?.min_interval_sec ?? raw?.minIntervalSec ?? 90,
    warmupEnabled: raw?.warmup_enabled ?? raw?.warmupEnabled ?? false,
  };
}

export function normalizeSender(raw: any): CampaignSender {
  return {
    senderOrg: raw?.sender_org ?? raw?.senderOrg ?? "",
    senderAddress: raw?.sender_address ?? raw?.senderAddress ?? "",
    senderContact: raw?.sender_contact ?? raw?.senderContact ?? "",
  };
}

export function normalizeStats(raw: any): CampaignStats {
  return {
    total: Number(raw?.total ?? 0),
    queued: Number(raw?.queued ?? 0),
    sent: Number(raw?.sent ?? 0),
    failed: Number(raw?.failed ?? 0),
    skipped: Number(raw?.skipped ?? 0),
    opened: Number(raw?.opened ?? 0),
    clicked: Number(raw?.clicked ?? 0),
    replied: Number(raw?.replied ?? 0),
    bounced: Number(raw?.bounced ?? 0),
    unsubscribed: Number(raw?.unsubscribed ?? 0),
  };
}

export function normalizeCampaign(raw: any): Campaign {
  return {
    id: raw?.id ?? "",
    name: raw?.name ?? "",
    status: (raw?.status ?? "draft") as CampaignStatus,
    subject: raw?.subject ?? "",
    body: raw?.body ?? "",
    trackOpens: raw?.track_opens ?? raw?.trackOpens ?? false,
    trackClicks: raw?.track_clicks ?? raw?.trackClicks ?? false,
    schedule: normalizeSchedule(raw?.schedule),
    sender: normalizeSender(raw?.sender),
    mailboxIds: raw?.mailbox_ids ?? raw?.mailboxIds ?? [],
    stats: normalizeStats(raw?.stats),
    createdBy: raw?.created_by ?? raw?.createdBy ?? "",
    startedAt: raw?.started_at ?? raw?.startedAt ?? undefined,
    completedAt: raw?.completed_at ?? raw?.completedAt ?? undefined,
    createdAt: raw?.created_at ?? raw?.createdAt ?? "",
    updatedAt: raw?.updated_at ?? raw?.updatedAt ?? "",
  };
}

export function normalizeRecipient(raw: any): CampaignRecipient {
  return {
    id: raw?.id ?? "",
    customerId: raw?.customer_id ?? raw?.customerId ?? "",
    customerName: raw?.customer_name ?? raw?.customerName ?? "",
    customerCorporation: raw?.customer_corporation ?? raw?.customerCorporation ?? "",
    email: raw?.email ?? "",
    status: raw?.status ?? "",
    error: raw?.error ?? "",
    sentAt: raw?.sent_at ?? raw?.sentAt ?? undefined,
    firstOpenedAt: raw?.first_opened_at ?? raw?.firstOpenedAt ?? undefined,
    firstClickedAt: raw?.first_clicked_at ?? raw?.firstClickedAt ?? undefined,
    repliedAt: raw?.replied_at ?? raw?.repliedAt ?? undefined,
    bouncedAt: raw?.bounced_at ?? raw?.bouncedAt ?? undefined,
    unsubscribedAt: raw?.unsubscribed_at ?? raw?.unsubscribedAt ?? undefined,
  };
}

export function normalizeCampaignEvent(raw: any): CampaignRecipientEvent {
  return {
    id: raw?.id ?? "",
    kind: raw?.kind ?? "",
    url: raw?.url ?? "",
    userAgent: raw?.user_agent ?? raw?.userAgent ?? "",
    createdAt: raw?.created_at ?? raw?.createdAt ?? "",
  };
}

export function normalizeSuppression(raw: any): Suppression {
  return {
    id: raw?.id ?? "",
    email: raw?.email ?? "",
    reason: raw?.reason ?? "",
    campaignId: raw?.campaign_id ?? raw?.campaignId ?? undefined,
    note: raw?.note ?? "",
    createdAt: raw?.created_at ?? raw?.createdAt ?? "",
  };
}

/**
 * Connect エラーレスポンス (`{"code": "...", "message": "..."}`) から
 * 日本語メッセージを取り出す。JSON でなければ生テキストを返す。
 */
export function parseConnectError(text: string, status?: number): string {
  try {
    const parsed = JSON.parse(text);
    if (parsed?.message) return parsed.message as string;
  } catch {
    /* not JSON */
  }
  return text || (status ? `HTTP ${status}` : "unknown error");
}

/** protojson の RFC3339 timestamp を日本語ローカル表記に整形。 */
export function formatTimestamp(ts?: string): string {
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 曜日 bitmask (Mon=1..Sun=64) を "月・火・…" 表記に。0 は平日扱い。 */
export function formatSendDays(mask: number): string {
  const effective = mask === 0 ? 31 : mask;
  const labels = ["月", "火", "水", "木", "金", "土", "日"];
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (effective & (1 << i)) out.push(labels[i]);
  }
  return out.join("・") || "-";
}
