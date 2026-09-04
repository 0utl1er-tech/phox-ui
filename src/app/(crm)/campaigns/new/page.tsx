"use client";

// Phase 27a: 新規キャンペーン作成ウィザード。
// ①受信者確認 → ②送信設定 → ③本文 → ④確認 (特電法表示) → 下書き作成。
// 受信者は campaign-selection ストア (Book 一覧/検索結果で選択) から読む。
//
// 注: SendTestEmail はキャンペーン ID が必要なため、テスト送信は
// 下書き作成後にキャンペーン詳細ページから実行する。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiSend,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import { useCampaignSelectionStore } from "@/store/campaign-selection";
import {
  applyTemplate,
  todayJST,
  TEMPLATE_PLACEHOLDERS,
  type TemplateVars,
} from "@/lib/mail-template";
import {
  normalizeCampaign,
  parseConnectError,
  formatSendDays,
} from "@/lib/campaign";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"] as const;

// 本文/件名に挿入できるトークン (unsubscribe_url は backend が実送信時に置換)
const INSERTABLE_PLACEHOLDERS = [...TEMPLATE_PLACEHOLDERS, "unsubscribe_url"] as const;

interface Mailbox {
  id: string;
  address: string;
  displayName: string;
}

interface BookOption {
  id: string;
  name: string;
}

interface MailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface CreateResult {
  campaignId: string;
  queuedCount: number;
  skippedNoEmail: number;
  skippedSuppressed: number;
  skippedDuplicate: number;
  /** Phase 27f: MX レコードが無く配信不能と判定して除外した件数。 */
  skippedNoMx: number;
  /** Phase 27f: 送信対象に含まれる role アドレス (info@ 等) の件数 (除外はしない)。 */
  roleAddressCount: number;
}

// Phase 27e: フォローアップ (2 通目以降) の入力ドラフト。stepNo は送信不要 (自動採番)。
interface FollowupDraft {
  waitDays: number;
  subject: string;
  body: string;
}

const MAX_FOLLOWUPS = 5;

type WizardStep = 1 | 2 | 3 | 4;

const STEP_TITLES: Record<WizardStep, string> = {
  1: "受信者確認",
  2: "送信設定",
  3: "本文",
  4: "確認",
};

export default function NewCampaignPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const senderName = useAuthStore((s) => s.user?.name ?? "");
  const senderMail = useAuthStore((s) => s.user?.email ?? "");

  const selected = useCampaignSelectionStore((s) => s.selected);
  const toggle = useCampaignSelectionStore((s) => s.toggle);
  const clearSelection = useCampaignSelectionStore((s) => s.clear);

  const [step, setStep] = useState<WizardStep>(1);

  // --- ① 受信者: Book 全体を追加 (Phase 28a) ---
  // 選択 Book の全顧客はサーバ側で受信者スナップショットに展開される
  // (customer_ids と union + dedup)。
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [bookToAdd, setBookToAdd] = useState("");

  // --- ② 送信設定 ---
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailboxIds, setSelectedMailboxIds] = useState<string[]>([]);
  const [sendStartHour, setSendStartHour] = useState(9);
  const [sendEndHour, setSendEndHour] = useState(18);
  const [sendDays, setSendDays] = useState(31); // 平日
  const [dailyCap, setDailyCap] = useState(100);
  const [minIntervalSec, setMinIntervalSec] = useState(90);
  const [warmupEnabled, setWarmupEnabled] = useState(true);
  // Phase 27f: バウンス率による自動停止のしきい値 (%)。0 で無効。
  const [bouncePauseThreshold, setBouncePauseThreshold] = useState(5);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);

  // --- ③ 本文 ---
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [books, setBooks] = useState<BookOption[]>([]);
  const [templateBookId, setTemplateBookId] = useState("");
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");
  // Phase 27e: フォローアップシーケンス (最大 5 ステップ)
  const [followups, setFollowups] = useState<FollowupDraft[]>([]);

  // --- ④ 確認 (特電法) ---
  const [senderOrg, setSenderOrg] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [senderContact, setSenderContact] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);

  const recipients = useMemo(() => Array.from(selected.entries()), [selected]);
  const noEmailCount = useMemo(
    () => recipients.filter(([, info]) => !info.email).length,
    [recipients],
  );

  // Phase 28a: 個別選択 or Book 全体のどちらかがあれば先に進める。
  const hasRecipients = recipients.length > 0 || selectedBookIds.length > 0;
  const selectedBooks = useMemo(
    () => selectedBookIds.map((id) => books.find((b) => b.id === id) ?? { id, name: id }),
    [selectedBookIds, books],
  );
  const addableBooks = useMemo(
    () => books.filter((b) => !selectedBookIds.includes(b.id)),
    [books, selectedBookIds],
  );

  const addBook = () => {
    if (!bookToAdd || selectedBookIds.includes(bookToAdd)) return;
    setSelectedBookIds((prev) => [...prev, bookToAdd]);
    setBookToAdd("");
  };
  const removeBook = (id: string) => {
    setSelectedBookIds((prev) => prev.filter((x) => x !== id));
  };

  // メールボックス一覧 (editor 以上のみ)
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
        setMailboxes(
          (data.mailboxes ?? [])
            .filter((m: any) => (m.active ?? false) && (m.role === "ROLE_EDITOR" || m.role === "ROLE_OWNER"))
            .map((m: any) => ({
              id: m.id ?? "",
              address: m.address ?? "",
              displayName: m.displayName ?? m.display_name ?? "",
            })),
        );
      } catch (e) {
        console.error("fetch mailboxes failed", e);
      }
    };
    void load();
  }, [accessToken]);

  // テンプレ選択用の Book 一覧
  useEffect(() => {
    if (!accessToken) return;
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/book.v1.BookService/ListBooks`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        if (!response.ok) return;
        const data = await response.json();
        setBooks(
          (data.books ?? []).map((b: any) => ({ id: b.id ?? "", name: b.name ?? "" })),
        );
      } catch (e) {
        console.error("fetch books failed", e);
      }
    };
    void load();
  }, [accessToken]);

  // 選択 Book のテンプレ一覧
  useEffect(() => {
    setTemplates([]);
    setSelectedTemplateId("");
    if (!accessToken || !templateBookId) return;
    const load = async () => {
      try {
        const response = await fetch(
          `${API_URL}/mailtemplate.v1.MailTemplateService/ListMailTemplatesByBook`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ book_id: templateBookId }),
          },
        );
        if (!response.ok) return;
        const data = await response.json();
        setTemplates(
          (data.templates ?? []).map((t: any) => ({
            id: t.id ?? "",
            name: t.name ?? "",
            subject: t.subject ?? "",
            body: t.body ?? "",
          })),
        );
      } catch (e) {
        console.error("fetch mail templates failed", e);
      }
    };
    void load();
  }, [accessToken, templateBookId]);

  const toggleMailbox = (id: string) => {
    setSelectedMailboxIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleWeekday = (bit: number) => {
    setSendDays((prev) => prev ^ bit);
  };

  // テンプレをそのまま (トークン未置換で) 挿入する。
  // 一斉送信では実送信時に受信者ごとの値で置換されるため、トークンを残す。
  const handleApplyTemplate = () => {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  // プレースホルダをカーソル位置に挿入
  const insertPlaceholder = (key: string) => {
    const token = `{{${key}}}`;
    if (activeField === "subject") {
      const el = subjectRef.current;
      const start = el?.selectionStart ?? subject.length;
      const end = el?.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + token + subject.slice(end);
      setSubject(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + token.length, start + token.length);
      });
    } else {
      const el = bodyRef.current;
      const start = el?.selectionStart ?? body.length;
      const end = el?.selectionEnd ?? body.length;
      const next = body.slice(0, start) + token + body.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start + token.length, start + token.length);
      });
    }
  };

  // ライブプレビュー用のサンプル値 (先頭の受信者があればそれを使う)
  const previewVars = useMemo((): TemplateVars => {
    const first = recipients[0];
    return {
      customer_name: first?.[1].name || "山田 太郎",
      customer_corporation: "株式会社サンプル",
      customer_mail: first?.[1].email || "taro@example.com",
      customer_phone: "03-0000-0000",
      sender_name: senderName,
      sender_mail: senderMail,
      today: todayJST(),
    };
  }, [recipients, senderName, senderMail]);

  const renderPreview = useCallback(
    (text: string) =>
      applyTemplate(text, previewVars).replace(
        /\{\{\s*unsubscribe_url\s*\}\}/g,
        "https://.../u/xxxxx (実送信時に挿入)",
      ),
    [previewVars],
  );

  const canProceedStep2 = useMemo(
    () =>
      selectedMailboxIds.length > 0 &&
      sendEndHour > sendStartHour &&
      dailyCap >= 1 &&
      dailyCap <= 1000 &&
      minIntervalSec >= 10 &&
      minIntervalSec <= 3600 &&
      bouncePauseThreshold >= 0 &&
      bouncePauseThreshold <= 100,
    [
      selectedMailboxIds,
      sendStartHour,
      sendEndHour,
      dailyCap,
      minIntervalSec,
      bouncePauseThreshold,
    ],
  );

  // Phase 27e: フォローアップの操作ヘルパー
  const addFollowup = () => {
    setFollowups((prev) =>
      prev.length >= MAX_FOLLOWUPS
        ? prev
        : [...prev, { waitDays: 3, subject: "", body: "" }],
    );
  };
  const updateFollowup = (index: number, patch: Partial<FollowupDraft>) => {
    setFollowups((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  };
  const removeFollowup = (index: number) => {
    setFollowups((prev) => prev.filter((_, i) => i !== index));
  };

  const followupsValid = useMemo(
    () =>
      followups.every(
        (f) =>
          f.body.trim().length > 0 &&
          Number.isFinite(f.waitDays) &&
          f.waitDays >= 1 &&
          f.waitDays <= 60,
      ),
    [followups],
  );

  const canProceedStep3 = useMemo(
    () => name.trim().length > 0 && followupsValid,
    [name, followupsValid],
  );

  const canSubmit = useMemo(
    () =>
      !isSubmitting &&
      hasRecipients &&
      canProceedStep2 &&
      canProceedStep3 &&
      senderOrg.trim().length > 0 &&
      senderAddress.trim().length > 0 &&
      senderContact.trim().length > 0,
    [isSubmitting, hasRecipients, canProceedStep2, canProceedStep3, senderOrg, senderAddress, senderContact],
  );

  const handleCreate = async () => {
    if (!canSubmit || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/campaign.v1.CampaignService/CreateCampaign`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            customerIds: recipients.map(([id]) => id),
            // Phase 28a: Book 全体はサーバ側で展開される (customer_ids と union + dedup)
            bookIds: selectedBookIds,
            mailboxIds: selectedMailboxIds,
            subject,
            body,
            schedule: {
              sendStartHour,
              sendEndHour,
              sendDays,
              dailyCapPerMailbox: dailyCap,
              minIntervalSec,
              warmupEnabled,
              bouncePauseThreshold,
            },
            sender: {
              senderOrg: senderOrg.trim(),
              senderAddress: senderAddress.trim(),
              senderContact: senderContact.trim(),
            },
            trackOpens,
            trackClicks,
            // Phase 27e: フォローアップ (stepNo は backend が自動採番)
            followups: followups.map((f) => ({
              waitDays: f.waitDays,
              subject: f.subject,
              body: f.body,
            })),
          }),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(parseConnectError(text, response.status));
      }
      const data = await response.json();
      const campaign = normalizeCampaign(data.campaign);
      setCreateResult({
        campaignId: campaign.id,
        queuedCount: Number(data.queued_count ?? data.queuedCount ?? 0),
        skippedNoEmail: Number(data.skipped_no_email ?? data.skippedNoEmail ?? 0),
        skippedSuppressed: Number(data.skipped_suppressed ?? data.skippedSuppressed ?? 0),
        skippedDuplicate: Number(data.skipped_duplicate ?? data.skippedDuplicate ?? 0),
        skippedNoMx: Number(data.skipped_no_mx ?? data.skippedNoMx ?? 0),
        roleAddressCount: Number(data.role_address_count ?? data.roleAddressCount ?? 0),
      });
      clearSelection();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`キャンペーンの作成に失敗しました: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------- 作成完了ビュー ----------
  if (createResult) {
    const totalSkipped =
      createResult.skippedNoEmail +
      createResult.skippedSuppressed +
      createResult.skippedDuplicate +
      createResult.skippedNoMx;
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white border rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <FiCheck className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">下書きを作成しました</h1>
            <p className="text-sm text-gray-600 mb-6">
              {createResult.queuedCount.toLocaleString()} 件をキューに登録しました
              {totalSkipped > 0 && ` (${totalSkipped.toLocaleString()} 件スキップ)`}
            </p>

            {totalSkipped > 0 && (
              <div className="text-left bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm text-yellow-800 space-y-1">
                <p className="font-medium">スキップ内訳</p>
                {createResult.skippedNoEmail > 0 && (
                  <p>・メールアドレス未登録: {createResult.skippedNoEmail.toLocaleString()} 件</p>
                )}
                {createResult.skippedSuppressed > 0 && (
                  <p>・サプレッションリスト登録済み: {createResult.skippedSuppressed.toLocaleString()} 件</p>
                )}
                {createResult.skippedDuplicate > 0 && (
                  <p>・アドレス重複: {createResult.skippedDuplicate.toLocaleString()} 件</p>
                )}
                {createResult.skippedNoMx > 0 && (
                  <p>
                    ・配信不能ドメイン (MXレコードなし):{" "}
                    {createResult.skippedNoMx.toLocaleString()} 件
                  </p>
                )}
              </div>
            )}

            {/* Phase 27f: role アドレスは除外していないのでエラーではなく注意喚起 */}
            {createResult.roleAddressCount > 0 && (
              <div className="text-left bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
                info@ などの代表アドレスが{" "}
                {createResult.roleAddressCount.toLocaleString()} 件含まれています
                (送信はされますが、返信率が低く苦情が出やすい傾向があります)
              </div>
            )}

            <p className="text-xs text-gray-500 mb-6">
              送信はまだ開始されていません。詳細ページでテスト送信・内容確認のうえ「開始」してください。
            </p>

            <Button
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
              onClick={() => router.push(`/campaigns/${createResult.campaignId}`)}
            >
              キャンペーン詳細へ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- ウィザード本体 ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.push("/campaigns")}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            title="キャンペーン一覧へ"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">新規キャンペーン</h1>
        </div>

        {/* ステップインジケーター */}
        <div className="flex items-center gap-2 mb-6">
          {([1, 2, 3, 4] as WizardStep[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  s === step
                    ? "bg-blue-600 text-white font-medium"
                    : s < step
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                <span className="tabular-nums">{s}</span>
                <span className="hidden sm:inline">{STEP_TITLES[s]}</span>
              </div>
              {s < 4 && <FiChevronRight className="w-4 h-4 text-gray-400" />}
            </div>
          ))}
        </div>

        <div className="bg-white border rounded-2xl p-6">
          {/* ---------- ① 受信者確認 ---------- */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">受信者の確認</h2>

              {/* ---------- Phase 28a: Book 全体を追加 ---------- */}
              <div className="space-y-2 rounded-md bg-blue-50 border border-blue-100 p-3">
                <p className="text-sm font-medium text-gray-700">Book 全体を追加</p>
                <p className="text-xs text-gray-500">
                  Book 内の全顧客をまとめて受信者にします (作成時にサーバ側で展開され、
                  個別選択分と重複する顧客は 1 件にまとめられます)。
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="追加する Book 選択"
                    value={bookToAdd}
                    onChange={(e) => setBookToAdd(e.target.value)}
                    className="flex-1 min-w-[180px] border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">(Book を選択)</option>
                    {addableBooks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBook}
                    disabled={!bookToAdd}
                  >
                    <FiPlus className="w-4 h-4 mr-1" />
                    追加
                  </Button>
                </div>
                {selectedBooks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedBooks.map((b) => (
                      <span
                        key={b.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium"
                      >
                        {b.name}
                        <button
                          type="button"
                          onClick={() => removeBook(b.id)}
                          className="p-0.5 hover:bg-blue-200 rounded-full transition-colors"
                          title={`${b.name} を外す`}
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {recipients.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <p className="text-gray-600">
                    個別の受信者が選択されていません。Book の顧客一覧または検索結果で
                    チェックボックスから選択するか、上の「Book 全体を追加」を使ってください。
                  </p>
                  <Button variant="outline" onClick={() => router.back()}>
                    <FiArrowLeft className="w-4 h-4 mr-2" />
                    一覧に戻る
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    {recipients.length.toLocaleString()} 件の顧客が選択されています。
                  </p>
                  {noEmailCount > 0 && (
                    <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                      <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        {noEmailCount.toLocaleString()} 件はメールアドレスが未登録または不明です。
                        アドレスの無い顧客は作成時に自動でスキップされます。
                      </p>
                    </div>
                  )}
                  <div className="border rounded-lg max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {recipients.map(([id, info]) => (
                      <div key={id} className="flex items-center gap-3 px-4 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {info.name || "(名前なし)"}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {info.email || "メールアドレス未登録/不明"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggle(id, info)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="選択から外す"
                        >
                          <FiX className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------- ② 送信設定 ---------- */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">送信設定</h2>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  送信メールボックス <span className="text-red-600">*</span>
                </p>
                <p className="text-xs text-gray-500">
                  複数選ぶと送信が分散されます (editor 以上の権限を持つメールボックスのみ表示)。
                </p>
                {mailboxes.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                    利用可能なメールボックスがありません。設定画面でメールボックスを追加してください。
                  </p>
                ) : (
                  <div className="border rounded-lg divide-y divide-gray-100">
                    {mailboxes.map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMailboxIds.includes(m.id)}
                          onChange={() => toggleMailbox(m.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900">
                          {m.displayName ? `${m.displayName} <${m.address}>` : m.address}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="send-hours-start">
                    送信時間帯 (Asia/Tokyo)
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id="send-hours-start"
                      aria-label="送信開始時刻"
                      value={sendStartHour}
                      onChange={(e) => setSendStartHour(Number(e.target.value))}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>{h}時</option>
                      ))}
                    </select>
                    <span className="text-gray-500">〜</span>
                    <select
                      aria-label="送信終了時刻"
                      value={sendEndHour}
                      onChange={(e) => setSendEndHour(Number(e.target.value))}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>{h}時</option>
                      ))}
                    </select>
                  </div>
                  {sendEndHour <= sendStartHour && (
                    <p className="text-xs text-red-600">終了時刻は開始時刻より後にしてください</p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">送信曜日</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {WEEKDAY_LABELS.map((label, i) => {
                      const bit = 1 << i;
                      const checked = (sendDays & bit) !== 0;
                      return (
                        <label
                          key={label}
                          className={`px-2.5 py-1.5 rounded-md border text-sm cursor-pointer select-none transition-colors ${
                            checked
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleWeekday(bit)}
                            className="sr-only"
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                  {sendDays === 0 && (
                    <p className="text-xs text-gray-500">未選択の場合は平日扱いになります</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="daily-cap">
                    日次送信上限 / メールボックス
                  </label>
                  <Input
                    id="daily-cap"
                    type="number"
                    min={1}
                    max={1000}
                    value={dailyCap}
                    onChange={(e) => setDailyCap(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="min-interval">
                    送信間隔 (秒)
                  </label>
                  <Input
                    id="min-interval"
                    type="number"
                    min={10}
                    max={3600}
                    value={minIntervalSec}
                    onChange={(e) => setMinIntervalSec(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Phase 27f: バウンス率サーキットブレーカー */}
              <div className="space-y-1 pt-1">
                <label
                  className="text-sm font-medium text-gray-700"
                  htmlFor="bounce-pause-threshold"
                >
                  バウンス率による自動停止
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="bounce-pause-threshold"
                    type="number"
                    min={0}
                    max={100}
                    value={bouncePauseThreshold}
                    onChange={(e) => setBouncePauseThreshold(Number(e.target.value))}
                    className="max-w-[120px]"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-500">
                  バウンス率がこの値を超えるとキャンペーンを自動的に一時停止します。0 で無効。
                  送信ドメインの評価を守るための安全装置です。
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={warmupEnabled}
                    onChange={(e) => setWarmupEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    ウォームアップを有効にする (新しいメールボックスの送信量を段階的に増やす)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackOpens}
                    onChange={(e) => setTrackOpens(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">開封トラッキング</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackClicks}
                    onChange={(e) => setTrackClicks(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">クリックトラッキング</span>
                </label>
              </div>
            </div>
          )}

          {/* ---------- ③ 本文 ---------- */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">メール本文</h2>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="campaign-name">
                  キャンペーン名 <span className="text-red-600">*</span>
                </label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: 2026年9月 新規開拓 (整体院)"
                />
              </div>

              {/* テンプレート適用 */}
              {books.length > 0 && (
                <div className="space-y-1 rounded-md bg-blue-50 border border-blue-100 p-3">
                  <p className="text-sm font-medium text-gray-700">テンプレートを適用</p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      aria-label="テンプレートの Book 選択"
                      value={templateBookId}
                      onChange={(e) => setTemplateBookId(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">(Book を選択)</option>
                      {books.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label="テンプレート選択"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      disabled={templates.length === 0}
                      className="flex-1 min-w-[160px] border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
                    >
                      <option value="">
                        {templateBookId && templates.length === 0
                          ? "(テンプレートなし)"
                          : "(選択なし)"}
                      </option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleApplyTemplate}
                      disabled={!selectedTemplateId}
                    >
                      適用
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    プレースホルダはそのまま残り、実送信時に受信者ごとの値で置換されます
                  </p>
                </div>
              )}

              {/* プレースホルダチップ */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500">
                  プレースホルダを挿入 (カーソル位置に入ります)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {INSERTABLE_PLACEHOLDERS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => insertPlaceholder(key)}
                      className="px-2 py-1 text-xs font-mono bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-md text-gray-700 transition-colors"
                    >
                      {`{{${key}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 編集ペイン */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700" htmlFor="campaign-subject">
                      件名
                    </label>
                    <Input
                      id="campaign-subject"
                      ref={subjectRef}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      onFocus={() => setActiveField("subject")}
                      placeholder="件名 (開始時に必須)"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700" htmlFor="campaign-body">
                      本文
                    </label>
                    <Textarea
                      id="campaign-body"
                      ref={bodyRef}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onFocus={() => setActiveField("body")}
                      rows={14}
                      placeholder={"{{customer_name}} 様\n\nはじめまして。..."}
                    />
                  </div>
                </div>

                {/* プレビューペイン */}
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">プレビュー (サンプル値)</p>
                  <div className="border rounded-lg bg-gray-50 p-3 text-sm h-full min-h-[200px]">
                    <p className="font-medium text-gray-900 border-b pb-2 mb-2 break-words">
                      {renderPreview(subject) || "(件名なし)"}
                    </p>
                    <div className="whitespace-pre-wrap break-words text-gray-800">
                      {renderPreview(body) || "(本文なし)"}
                    </div>
                    {/* 法定フッターのモックプレビュー */}
                    <div className="mt-4 pt-2 border-t border-dashed border-gray-300 text-xs text-gray-500 whitespace-pre-wrap">
                      {"──────────────────────\n"}
                      送信者: {senderOrg || "(④で入力する会社名/氏名)"}{"\n"}
                      所在地: {senderAddress || "(④で入力する住所)"}{"\n"}
                      連絡先: {senderContact || "(④で入力する連絡先)"}{"\n"}
                      配信停止: https://.../u/xxxxx (実送信時に挿入)
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    法令 (特定電子メール法) 対応のため、すべてのメール末尾に送信者情報と
                    配信停止 URL を含むフッターが自動で追記されます。
                  </p>
                </div>
              </div>

              {/* ---------- Phase 27e: フォローアップシーケンス ---------- */}
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    フォローアップ (返信が無かった人への追いメール)
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    前の送信から指定日数たっても返信が無い受信者にだけ、同じスレッドへの
                    返信として自動送信されます。受信者が返信・配信停止・バウンスした時点で
                    以降のフォローアップは自動停止します。
                  </p>
                </div>

                {followups.map((f, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                        {i + 2}通目
                      </span>
                      <span className="text-sm text-gray-700 flex items-center gap-1.5 flex-wrap">
                        前の送信から
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          value={f.waitDays}
                          onChange={(e) =>
                            updateFollowup(i, { waitDays: Number(e.target.value) })
                          }
                          aria-label={`${i + 2}通目の待機日数`}
                          className="w-20 inline-block"
                        />
                        日後、返信がなければ送信
                      </span>
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => removeFollowup(i)}
                        className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
                        title={`${i + 2}通目を削除`}
                      >
                        <FiTrash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                    {(f.waitDays < 1 || f.waitDays > 60 || !Number.isFinite(f.waitDays)) && (
                      <p className="text-xs text-red-600">日数は 1〜60 で指定してください</p>
                    )}
                    <div className="space-y-1">
                      <label
                        className="text-sm font-medium text-gray-700"
                        htmlFor={`followup-subject-${i}`}
                      >
                        件名
                      </label>
                      <Input
                        id={`followup-subject-${i}`}
                        value={f.subject}
                        onChange={(e) => updateFollowup(i, { subject: e.target.value })}
                        placeholder="空欄なら『Re: 1通目の件名』で同じスレッドに返信"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        className="text-sm font-medium text-gray-700"
                        htmlFor={`followup-body-${i}`}
                      >
                        本文 <span className="text-red-600">*</span>
                      </label>
                      <Textarea
                        id={`followup-body-${i}`}
                        value={f.body}
                        onChange={(e) => updateFollowup(i, { body: e.target.value })}
                        rows={8}
                        placeholder={"{{customer_name}} 様\n\n先日お送りしたご案内の件、いかがでしょうか。..."}
                      />
                      <p className="text-xs text-gray-500">
                        1通目と同じ差し込みタグ ({"{{customer_name}}"} など) が使えます
                      </p>
                    </div>
                    {f.body && (
                      <details className="text-sm">
                        <summary className="text-xs text-gray-600 cursor-pointer select-none hover:text-gray-900">
                          プレビュー (サンプル値)
                        </summary>
                        <div className="mt-2 border rounded-lg bg-white p-3 whitespace-pre-wrap break-words text-gray-800">
                          {renderPreview(f.body)}
                        </div>
                      </details>
                    )}
                  </div>
                ))}

                {followups.length < MAX_FOLLOWUPS ? (
                  <Button type="button" variant="outline" size="sm" onClick={addFollowup}>
                    <FiPlus className="w-4 h-4 mr-1" />
                    フォローアップを追加
                    {followups.length > 0 && ` (${followups.length}/${MAX_FOLLOWUPS})`}
                  </Button>
                ) : (
                  <p className="text-xs text-gray-500">
                    フォローアップは最大 {MAX_FOLLOWUPS} 通までです
                  </p>
                )}
              </div>

              <p className="text-xs text-gray-500">
                テスト送信は下書き作成後、キャンペーン詳細ページから実行できます。
              </p>
            </div>
          )}

          {/* ---------- ④ 確認 ---------- */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900">確認・送信者表示</h2>

              <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 space-y-3">
                <p className="text-sm text-gray-700">
                  特定電子メール法により、広告宣伝メールには送信者の氏名/名称・住所・
                  連絡先の表示が義務付けられています。以下の内容はすべてのメールの
                  フッターに自動で挿入されます。
                </p>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="sender-org">
                    会社名 / 氏名 <span className="text-red-600">*</span>
                  </label>
                  <Input
                    id="sender-org"
                    value={senderOrg}
                    onChange={(e) => setSenderOrg(e.target.value)}
                    placeholder="例: 株式会社アウトライヤー"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="sender-address">
                    住所 <span className="text-red-600">*</span>
                  </label>
                  <Input
                    id="sender-address"
                    value={senderAddress}
                    onChange={(e) => setSenderAddress(e.target.value)}
                    placeholder="例: 東京都..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="sender-contact">
                    連絡先 (電話 or 問い合わせ先) <span className="text-red-600">*</span>
                  </label>
                  <Input
                    id="sender-contact"
                    value={senderContact}
                    onChange={(e) => setSenderContact(e.target.value)}
                    placeholder="例: 03-0000-0000 / contact@example.com"
                  />
                </div>
              </div>

              {/* サマリー */}
              <div className="border rounded-lg divide-y divide-gray-100 text-sm">
                <div className="flex px-4 py-2">
                  <span className="w-40 text-gray-500 flex-shrink-0">キャンペーン名</span>
                  <span className="text-gray-900">{name || "-"}</span>
                </div>
                <div className="flex px-4 py-2">
                  <span className="w-40 text-gray-500 flex-shrink-0">受信者</span>
                  <span className="text-gray-900">
                    {[
                      recipients.length > 0
                        ? `個別 ${recipients.length.toLocaleString()} 件`
                        : "",
                      selectedBooks.length > 0
                        ? `Book 全体 ${selectedBooks.length} 冊 (${selectedBooks
                            .map((b) => b.name)
                            .join(", ")} — 作成時に展開)`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" + ") || "-"}
                  </span>
                </div>
                <div className="flex px-4 py-2">
                  <span className="w-40 text-gray-500 flex-shrink-0">メールボックス</span>
                  <span className="text-gray-900">
                    {mailboxes
                      .filter((m) => selectedMailboxIds.includes(m.id))
                      .map((m) => m.address)
                      .join(", ") || "-"}
                  </span>
                </div>
                <div className="flex px-4 py-2">
                  <span className="w-40 text-gray-500 flex-shrink-0">送信時間帯</span>
                  <span className="text-gray-900">
                    {sendStartHour}時〜{sendEndHour}時 / {formatSendDays(sendDays)}
                  </span>
                </div>
                <div className="flex px-4 py-2">
                  <span className="w-40 text-gray-500 flex-shrink-0">ペーシング</span>
                  <span className="text-gray-900">
                    日次 {dailyCap} 通/mailbox・間隔 {minIntervalSec} 秒・ウォームアップ{warmupEnabled ? "あり" : "なし"}
                    ・バウンス率{bouncePauseThreshold > 0 ? `${bouncePauseThreshold}% で自動停止` : "による自動停止なし"}
                  </span>
                </div>
                <div className="flex px-4 py-2">
                  <span className="w-40 text-gray-500 flex-shrink-0">トラッキング</span>
                  <span className="text-gray-900">
                    開封{trackOpens ? "○" : "×"} / クリック{trackClicks ? "○" : "×"}
                  </span>
                </div>
                <div className="flex px-4 py-2">
                  <span className="w-40 text-gray-500 flex-shrink-0">件名</span>
                  <span className="text-gray-900 break-words">{subject || "(未入力 — 開始前に必須)"}</span>
                </div>
                <div className="flex px-4 py-2">
                  <span className="w-40 text-gray-500 flex-shrink-0">シーケンス構成</span>
                  <span className="text-gray-900">
                    {followups.length === 0
                      ? "メール 1通のみ (フォローアップなし)"
                      : `メール ${followups.length + 1}通構成 (1通目${followups
                          .map((f) => ` + ${f.waitDays}日後`)
                          .join("")})`}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                「下書き作成」ではまだ送信されません。詳細ページで「開始」すると送信が始まります。
              </p>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <FiAlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* フッターナビ */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <div>
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((s) => (s - 1) as WizardStep)}
                  disabled={isSubmitting}
                >
                  <FiChevronLeft className="w-4 h-4 mr-1" />
                  戻る
                </Button>
              )}
            </div>
            <div>
              {step < 4 ? (
                <Button
                  type="button"
                  onClick={() => setStep((s) => (s + 1) as WizardStep)}
                  disabled={
                    (step === 1 && !hasRecipients) ||
                    (step === 2 && !canProceedStep2) ||
                    (step === 3 && !canProceedStep3)
                  }
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                >
                  次へ
                  <FiChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={!canSubmit}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                >
                  <FiSend className="w-4 h-4 mr-2" />
                  {isSubmitting ? "作成中..." : "下書き作成"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
