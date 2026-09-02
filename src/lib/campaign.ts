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
  /**
   * Phase 27f: ハードバウンス率 (%) の自動停止しきい値。0 で無効。
   * 既定 5 (DB default)。これを超えると backend がキャンペーンを一時停止する。
   */
  bouncePauseThreshold: number;
}

export interface CampaignSender {
  senderOrg: string;
  senderAddress: string;
  senderContact: string;
}

/**
 * Phase 27e: フォローアップステップ (2 通目以降)。前ステップ送信後、返信が
 * 無ければ waitDays 日後に同一スレッドへの返信として送られる。
 * subject 空 = "Re: <1通目の件名>"。
 */
export interface CampaignFollowup {
  /** 2.. (1 通目は Campaign.subject/body)。 */
  stepNo: number;
  waitDays: number;
  subject: string;
  body: string;
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
  /** Phase 27d: 最後に送信した時刻 (稼働インジケータ用)。 */
  lastSentAt?: string;
  /** Phase 27e: フォローアップ待ち (1 通以上送信済みで次ステップの時期待ち)。 */
  waitingFollowup: number;
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
  /** Phase 27d: running 中のみ。ペーシング設定から算出した完了予定 (目安)。 */
  estimatedCompletionAt?: string;
  /** Phase 27e: フォローアップステップ (2 通目以降)。空 = 単発キャンペーン。 */
  followups: CampaignFollowup[];
  /** Phase 27f: ハードバウンス率 (%) がこれを超えると自動一時停止。0 で無効。 */
  bouncePauseThreshold: number;
  /** Phase 27f: 自動一時停止された理由 (空 = 手動停止 or 停止していない)。 */
  healthPausedReason: string;
}

/**
 * Phase 27f: 送信元メールボックスの健全性 (CheckMailboxHealth)。
 * DNS を実引きするのでオンデマンド取得 (自動ポーリングしない)。
 */
export interface MailboxHealth {
  mailboxId: string;
  address: string;
  domain: string;

  // DNS 点検
  hasMx: boolean;
  mxHost: string;
  hasSpf: boolean;
  spf: string;
  hasDmarc: boolean;
  dmarc: string;
  /** none | quarantine | reject */
  dmarcPolicy: string;
  hasDkim: boolean;
  dkimSelector: string;

  // 直近 30 日の送信実績 (全キャンペーン横断)
  sent: number;
  bounced: number;
  unsubscribed: number;
  replied: number;
  /** % */
  bounceRate: number;
  /** % */
  unsubscribeRate: number;

  /** good | warn | bad */
  grade: string;
  warnings: string[];
}

/** Phase 27d: GetCampaignTimeseries の日次集計 1 日分。 */
export interface CampaignDailyStat {
  /** "YYYY-MM-DD" (JST)。 */
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
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
  /** Phase 27e: 現在のステップ (1 = 1通目)。 */
  currentStep: number;
  /** Phase 27e: 次ステップの送信予定時刻 (フォローアップ待ちの queued 行のみ)。 */
  nextStepAt?: string;
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
  // 注意: Connect の proto3 JSON は zero-value フィールドを省略するため、
  // 「無い」= 0 として扱う必要がある (sendStartHour: 0 は真夜中開始の有効値。
  // 9 などを当てると窓判定が実際の worker と食い違い「待機中」の誤表示になる)。
  // sendDays 0 は backend 同様「平日」の意味なので表示側で 31 に読み替える。
  const days = raw?.send_days ?? raw?.sendDays ?? 0;
  return {
    sendStartHour: raw?.send_start_hour ?? raw?.sendStartHour ?? 0,
    sendEndHour: raw?.send_end_hour ?? raw?.sendEndHour ?? 24,
    sendDays: days === 0 ? 31 : days,
    dailyCapPerMailbox: raw?.daily_cap_per_mailbox ?? raw?.dailyCapPerMailbox ?? 100,
    minIntervalSec: raw?.min_interval_sec ?? raw?.minIntervalSec ?? 90,
    warmupEnabled: raw?.warmup_enabled ?? raw?.warmupEnabled ?? false,
    // 欠損 = proto3 の zero-value 省略 = 0 = 自動停止無効。DB default は 5 なので
    // 既存キャンペーンは backend が 5 を返す (ここで 5 を補完してはいけない)。
    bouncePauseThreshold: Number(
      raw?.bounce_pause_threshold ?? raw?.bouncePauseThreshold ?? 0,
    ),
  };
}

/** Phase 27f: MailboxHealth の正規化 (snake/camel 両対応)。 */
export function normalizeMailboxHealth(raw: any): MailboxHealth {
  return {
    mailboxId: raw?.mailbox_id ?? raw?.mailboxId ?? "",
    address: raw?.address ?? "",
    domain: raw?.domain ?? "",
    hasMx: raw?.has_mx ?? raw?.hasMx ?? false,
    mxHost: raw?.mx_host ?? raw?.mxHost ?? "",
    hasSpf: raw?.has_spf ?? raw?.hasSpf ?? false,
    spf: raw?.spf ?? "",
    hasDmarc: raw?.has_dmarc ?? raw?.hasDmarc ?? false,
    dmarc: raw?.dmarc ?? "",
    dmarcPolicy: raw?.dmarc_policy ?? raw?.dmarcPolicy ?? "",
    hasDkim: raw?.has_dkim ?? raw?.hasDkim ?? false,
    dkimSelector: raw?.dkim_selector ?? raw?.dkimSelector ?? "",
    sent: Number(raw?.sent ?? 0),
    bounced: Number(raw?.bounced ?? 0),
    unsubscribed: Number(raw?.unsubscribed ?? 0),
    replied: Number(raw?.replied ?? 0),
    bounceRate: Number(raw?.bounce_rate ?? raw?.bounceRate ?? 0),
    unsubscribeRate: Number(raw?.unsubscribe_rate ?? raw?.unsubscribeRate ?? 0),
    grade: raw?.grade ?? "",
    warnings: (raw?.warnings ?? []) as string[],
  };
}

export function normalizeSender(raw: any): CampaignSender {
  return {
    senderOrg: raw?.sender_org ?? raw?.senderOrg ?? "",
    senderAddress: raw?.sender_address ?? raw?.senderAddress ?? "",
    senderContact: raw?.sender_contact ?? raw?.senderContact ?? "",
  };
}

/**
 * Phase 27e: フォローアップの正規化。proto3 JSON の zero-value 省略で
 * step_no/wait_days が欠損し得るため、step_no は配列位置 (index+2)、
 * wait_days は 3 をデフォルト補完する (wait_days は backend 検証で 1-60 のため
 * 0 は実際には来ないが防御的に)。
 */
export function normalizeFollowup(raw: any, index = 0): CampaignFollowup {
  const stepNo = Number(raw?.step_no ?? raw?.stepNo ?? 0);
  const waitDays = Number(raw?.wait_days ?? raw?.waitDays ?? 0);
  return {
    stepNo: stepNo > 0 ? stepNo : index + 2,
    waitDays: waitDays > 0 ? waitDays : 3,
    subject: raw?.subject ?? "",
    body: raw?.body ?? "",
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
    lastSentAt: raw?.last_sent_at ?? raw?.lastSentAt ?? undefined,
    waitingFollowup: Number(raw?.waiting_followup ?? raw?.waitingFollowup ?? 0),
  };
}

export function normalizeDailyStat(raw: any): CampaignDailyStat {
  return {
    date: raw?.date ?? "",
    sent: Number(raw?.sent ?? 0),
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
    estimatedCompletionAt:
      raw?.estimated_completion_at ?? raw?.estimatedCompletionAt ?? undefined,
    followups: ((raw?.followups ?? []) as any[]).map((f, i) =>
      normalizeFollowup(f, i),
    ),
    bouncePauseThreshold: Number(
      raw?.bounce_pause_threshold ?? raw?.bouncePauseThreshold ?? 0,
    ),
    healthPausedReason:
      raw?.health_paused_reason ?? raw?.healthPausedReason ?? "",
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
    // proto3 zero-value 省略: current_step 欠損 = 0 だが表示上は 1通目扱い。
    currentStep: Number(raw?.current_step ?? raw?.currentStep ?? 0) || 1,
    nextStepAt: raw?.next_step_at ?? raw?.nextStepAt ?? undefined,
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

// ---------------------------------------------------------------------------
// Phase 27d: 送信窓判定・時系列・完了予定のヘルパー群 (すべて JST 基準)
// ---------------------------------------------------------------------------

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const JST_DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** JST に平行移動した Date (getUTC* で JST の値が読める)。 */
function toJst(d: Date): Date {
  return new Date(d.getTime() + JST_OFFSET_MS);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** JST での "YYYY-MM-DD"。 */
export function jstDateString(now: Date = new Date()): string {
  const j = toJst(now);
  return `${j.getUTCFullYear()}-${pad2(j.getUTCMonth() + 1)}-${pad2(j.getUTCDate())}`;
}

/** JST での曜日 bit (Mon=1..Sun=64)。 */
function jstDayBit(d: Date): number {
  const mon0 = (toJst(d).getUTCDay() + 6) % 7; // 0=Mon..6=Sun
  return 1 << mon0;
}

/**
 * 今 (JST) が送信窓の中かどうか。
 * 窓 = 曜日 bitmask (0 は平日扱い) かつ sendStartHour <= 時 < sendEndHour。
 */
export function isInSendWindow(
  schedule: CampaignSchedule,
  now: Date = new Date(),
): boolean {
  const mask = schedule.sendDays === 0 ? 31 : schedule.sendDays;
  if (!(mask & jstDayBit(now))) return false;
  const hour = toJst(now).getUTCHours();
  return hour >= schedule.sendStartHour && hour < schedule.sendEndHour;
}

/**
 * 次の送信窓の開始を「本日 9時」「明日 9時」「9/1(月) 9時」のような表記で返す。
 * 窓の中にいる場合や設定が不正な場合は null。
 */
export function formatNextSendWindow(
  schedule: CampaignSchedule,
  now: Date = new Date(),
): string | null {
  if (isInSendWindow(schedule, now)) return null;
  const mask = schedule.sendDays === 0 ? 31 : schedule.sendDays;
  if (!(mask & 127)) return null;
  const hourNow = toJst(now).getUTCHours();
  for (let offset = 0; offset <= 7; offset++) {
    const day = new Date(now.getTime() + offset * DAY_MS);
    if (!(mask & jstDayBit(day))) continue;
    // 当日はまだ窓が始まっていない場合のみ候補
    if (offset === 0 && hourNow >= schedule.sendStartHour) continue;
    if (offset === 0) return `本日${schedule.sendStartHour}時`;
    if (offset === 1) return `明日${schedule.sendStartHour}時`;
    const j = toJst(day);
    const dow = JST_DAY_LABELS[j.getUTCDay()];
    return `${j.getUTCMonth() + 1}/${j.getUTCDate()}(${dow}) ${schedule.sendStartHour}時`;
  }
  return null;
}

/** 「たった今」「N分前」「N時間前」「N日前」の相対表記。 */
export function formatRelativeTime(
  ts?: string,
  now: Date = new Date(),
): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const diffSec = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (diffSec < 60) return "たった今";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`;
  return `${Math.floor(diffSec / 86400)}日前`;
}

/**
 * 完了予定の表記 (JST)。当日中なら「本日 15:40ごろ」、
 * それ以外は「9/3(水) 15:40ごろ」。
 */
export function formatEstimatedCompletion(
  ts?: string,
  now: Date = new Date(),
): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const j = toJst(d);
  const time = `${j.getUTCHours()}:${pad2(j.getUTCMinutes())}`;
  if (jstDateString(d) === jstDateString(now)) return `本日 ${time}ごろ`;
  const dow = JST_DAY_LABELS[j.getUTCDay()];
  return `${j.getUTCMonth() + 1}/${j.getUTCDate()}(${dow}) ${time}ごろ`;
}

/**
 * 時系列の欠損日を 0 で埋める。レンジ = days の最小日〜今日 (JST)。
 * days が空なら空配列。日付昇順で返す。
 */
export function fillDailyStats(
  days: CampaignDailyStat[],
  now: Date = new Date(),
): CampaignDailyStat[] {
  const byDate = new Map<string, CampaignDailyStat>();
  for (const d of days) {
    if (d.date) byDate.set(d.date, d);
  }
  if (byDate.size === 0) return [];
  const dates = [...byDate.keys()].sort();
  const start = new Date(`${dates[0]}T00:00:00Z`);
  const endStr = jstDateString(now) > dates[dates.length - 1]
    ? jstDateString(now)
    : dates[dates.length - 1];
  if (Number.isNaN(start.getTime())) return [...byDate.values()];
  const out: CampaignDailyStat[] = [];
  // 暴走防止に 2 年で打ち切り
  for (let t = start.getTime(), i = 0; i < 731; t += DAY_MS, i++) {
    const cur = new Date(t);
    const key = `${cur.getUTCFullYear()}-${pad2(cur.getUTCMonth() + 1)}-${pad2(cur.getUTCDate())}`;
    out.push(
      byDate.get(key) ?? {
        date: key,
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        bounced: 0,
        unsubscribed: 0,
      },
    );
    if (key >= endStr) break;
  }
  return out;
}
