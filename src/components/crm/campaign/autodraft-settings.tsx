"use client";

// Phase 28f: キャンペーン自動下書きの管理者設定。
//
// 28d の lakehouse パイプラインが Google Maps 由来のリードを Book
// (`GM_{業種}_{都道府県}_{YYYY-MM}_HPあり` / `_HPなし`) に自動投函する。
// ここでテンプレを登録しておくと、backend の worker が 15 分毎に「まだ
// 下書きを作っていない Book」を拾って**下書きだけ**を自動生成する。
// 送信の開始は常に人間がキャンペーン画面で押す。
//
// テンプレは Book 名パターン毎に複数登録できる:
//   - `GM\_%\_HPあり` … 既にホームページを持つ店への乗り換え提案
//   - `GM\_%\_HPなし` … ホームページを持たない店への制作提案
//     (メールが取れていないことが多く、実態は電話営業リスト。
//      下書きは作られるが送信対象は少ない = 除外が多いのは正常)

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2, FiFileText, FiLoader, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import {
  type CampaignAutoDraft,
  formatTimestamp,
  normalizeAutoDraft,
  parseConnectError,
} from "@/lib/campaign";
import { applyTemplate, type TemplateVars } from "@/lib/mail-template";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
const MAX_FOLLOWUPS = 5;

/** 28d の Book 命名規約に対応するパターンのプリセット。 */
const PATTERN_PRESETS: { label: string; pattern: string; hint: string }[] = [
  {
    label: "HPあり (乗り換え提案)",
    pattern: "GM\\_%\\_HPあり",
    hint: "既にホームページを持つ店。メールが取れているので送信対象になりやすい。",
  },
  {
    label: "HPなし (制作提案)",
    pattern: "GM\\_%\\_HPなし",
    hint: "ホームページを持たない店。メール未取得が多く、除外が多くても正常。",
  },
];

interface MailboxOption {
  id: string;
  address: string;
}

interface FollowupForm {
  waitDays: number;
  subject: string;
  body: string;
}

interface AutoDraftForm {
  id: string | null;
  name: string;
  bookNamePattern: string;
  enabled: boolean;
  subject: string;
  body: string;
  followups: FollowupForm[];
  mailboxIds: string[];
  sendStartHour: number;
  sendEndHour: number;
  sendDays: number;
  dailyCapPerMailbox: number;
  minIntervalSec: number;
  warmupEnabled: boolean;
  bouncePauseThreshold: number;
  senderOrg: string;
  senderAddress: string;
  senderContact: string;
  trackOpens: boolean;
  trackClicks: boolean;
}

function emptyForm(): AutoDraftForm {
  return {
    id: null,
    name: "",
    bookNamePattern: "",
    // 既定 OFF — 文面を確認してから有効化する。
    enabled: false,
    subject: "",
    body: "",
    followups: [],
    mailboxIds: [],
    sendStartHour: 9,
    sendEndHour: 18,
    sendDays: 31,
    dailyCapPerMailbox: 100,
    minIntervalSec: 90,
    warmupEnabled: true,
    bouncePauseThreshold: 5,
    senderOrg: "",
    senderAddress: "",
    senderContact: "",
    trackOpens: true,
    trackClicks: true,
  };
}

function formFromTemplate(t: CampaignAutoDraft): AutoDraftForm {
  return {
    id: t.id,
    name: t.name,
    bookNamePattern: t.bookNamePattern,
    enabled: t.enabled,
    subject: t.subject,
    body: t.body,
    followups: t.followups.map((f) => ({
      waitDays: f.waitDays,
      subject: f.subject,
      body: f.body,
    })),
    mailboxIds: t.mailboxIds,
    sendStartHour: t.schedule.sendStartHour,
    sendEndHour: t.schedule.sendEndHour,
    sendDays: t.schedule.sendDays,
    dailyCapPerMailbox: t.schedule.dailyCapPerMailbox,
    minIntervalSec: t.schedule.minIntervalSec,
    warmupEnabled: t.schedule.warmupEnabled,
    bouncePauseThreshold: t.schedule.bouncePauseThreshold,
    senderOrg: t.sender.senderOrg,
    senderAddress: t.sender.senderAddress,
    senderContact: t.sender.senderContact,
    trackOpens: t.trackOpens,
    trackClicks: t.trackClicks,
  };
}

const PREVIEW_VARS: TemplateVars = {
  customer_name: "山田 太郎",
  customer_corporation: "株式会社サンプル",
  customer_mail: "taro@example.com",
  customer_phone: "03-0000-0000",
};

export default function AutoDraftSettings({ canEdit }: { canEdit: boolean }) {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [templates, setTemplates] = useState<CampaignAutoDraft[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<AutoDraftForm | null>(null);

  const post = useCallback(
    async (method: string, body: unknown) => {
      const response = await fetch(`${API_URL}/campaign.v1.CampaignService/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(parseConnectError(text, response.status));
      }
      return response.json();
    },
    [accessToken],
  );

  const loadTemplates = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await post("ListCampaignAutoDrafts", {});
      setTemplates((data.auto_drafts ?? data.autoDrafts ?? []).map(normalizeAutoDraft));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setError(`自動下書き設定の取得に失敗しました: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, post]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  // 送信元メールボックス (editor 以上 + active のみ選べる)。
  useEffect(() => {
    if (!accessToken) return;
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/mailbox.v1.MailboxService/ListMailboxes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        if (!response.ok) return;
        const data = await response.json();
        setMailboxes(
          (data.mailboxes ?? [])
            .filter(
              (m: { active?: boolean; role?: string }) =>
                (m.active ?? false) && (m.role === "ROLE_EDITOR" || m.role === "ROLE_OWNER"),
            )
            .map((m: { id?: string; address?: string }) => ({
              id: m.id ?? "",
              address: m.address ?? "",
            })),
        );
      } catch {
        /* メールボックス一覧の失敗は致命的ではない */
      }
    };
    void load();
  }, [accessToken]);

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const patch = (p: Partial<AutoDraftForm>) => setForm((f) => (f ? { ...f, ...p } : f));

  const canSave = useMemo(() => {
    if (!form) return false;
    return (
      form.name.trim().length > 0 &&
      form.bookNamePattern.trim().length > 0 &&
      form.body.trim().length > 0 &&
      form.mailboxIds.length > 0 &&
      form.sendEndHour > form.sendStartHour &&
      form.followups.every((f) => f.body.trim().length > 0 && f.waitDays >= 1 && f.waitDays <= 60)
    );
  }, [form]);

  const handleSave = async () => {
    if (!form || !canSave || isSaving) return;
    setIsSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      bookNamePattern: form.bookNamePattern.trim(),
      enabled: form.enabled,
      subject: form.subject,
      body: form.body,
      followups: form.followups.map((f) => ({
        waitDays: f.waitDays,
        subject: f.subject,
        body: f.body,
      })),
      clearFollowups: form.followups.length === 0,
      mailboxIds: form.mailboxIds,
      schedule: {
        sendStartHour: form.sendStartHour,
        sendEndHour: form.sendEndHour,
        sendDays: form.sendDays,
        dailyCapPerMailbox: form.dailyCapPerMailbox,
        minIntervalSec: form.minIntervalSec,
        warmupEnabled: form.warmupEnabled,
        bouncePauseThreshold: form.bouncePauseThreshold,
      },
      sender: {
        senderOrg: form.senderOrg.trim(),
        senderAddress: form.senderAddress.trim(),
        senderContact: form.senderContact.trim(),
      },
      trackOpens: form.trackOpens,
      trackClicks: form.trackClicks,
    };
    try {
      if (form.id) {
        await post("UpdateCampaignAutoDraft", { id: form.id, ...payload });
      } else {
        await post("CreateCampaignAutoDraft", payload);
      }
      setForm(null);
      await loadTemplates();
      flash(form.id ? "テンプレートを更新しました" : "テンプレートを追加しました");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setError(`保存に失敗しました: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (t: CampaignAutoDraft) => {
    if (!canEdit || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await post("UpdateCampaignAutoDraft", { id: t.id, enabled: !t.enabled });
      await loadTemplates();
      flash(!t.enabled ? "自動下書きを有効にしました" : "自動下書きを無効にしました");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setError(`更新に失敗しました: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (t: CampaignAutoDraft) => {
    if (!canEdit || isSaving) return;
    if (!window.confirm(`テンプレート「${t.name}」を削除しますか？ (生成済みの下書きは残ります)`)) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await post("DeleteCampaignAutoDraft", { id: t.id });
      await loadTemplates();
      flash("テンプレートを削除しました");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setError(`削除に失敗しました: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none disabled:bg-gray-50";

  return (
    <div className="pt-4 border-t border-gray-200" data-testid="autodraft-settings">
      <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
        <FiFileText className="w-4 h-4" />
        キャンペーン自動下書き
      </p>
      <p className="text-sm text-gray-500 mb-3">
        自動収集したリストが Book に投函されると、パターンが一致するテンプレートで
        キャンペーンの<strong>下書き</strong>が自動生成されます (15分毎)。
        <strong>送信の開始は自動では行われません</strong> — 内容を確認して
        キャンペーン画面で「開始」を押してください。
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {message && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-green-600">{message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center py-4 text-gray-500">
          <FiLoader className="w-4 h-4 animate-spin mr-2" />
          読み込み中...
        </div>
      ) : (
        <>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-500 mb-3 rounded-lg border border-dashed border-gray-300 p-3">
              テンプレートは未登録です。登録するまで自動生成は行われません。
            </p>
          ) : (
            <div className="space-y-2 mb-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
                  data-testid="autodraft-row"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      {t.name}
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-xs",
                          t.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500",
                        ].join(" ")}
                      >
                        {t.enabled ? "有効" : "無効"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 break-all">
                      パターン: <code>{t.bookNamePattern}</code>
                    </p>
                    <p className="text-xs text-gray-500">
                      最終作成: {t.lastCreatedAt ? formatTimestamp(t.lastCreatedAt) : "未生成"} /
                      送信元 {t.mailboxIds.length} 件 / フォローアップ {t.followups.length} 通
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void handleToggle(t)}
                        disabled={isSaving}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        {t.enabled ? "無効にする" : "有効にする"}
                      </button>
                      <button
                        type="button"
                        aria-label="編集"
                        onClick={() => setForm(formFromTemplate(t))}
                        className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="削除"
                        onClick={() => void handleDelete(t)}
                        disabled={isSaving}
                        className="rounded-lg border border-gray-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {canEdit && !form && (
            <button
              type="button"
              onClick={() => setForm(emptyForm())}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              <FiPlus className="w-4 h-4" />
              テンプレートを追加
            </button>
          )}
          {!canEdit && (
            <p className="text-xs text-gray-400">テンプレートの追加・変更はオーナーのみ可能です</p>
          )}

          {form && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">
                  {form.id ? "テンプレートを編集" : "テンプレートを追加"}
                </p>
                <button
                  type="button"
                  aria-label="閉じる"
                  onClick={() => setForm(null)}
                  className="rounded-lg p-1 text-gray-500 hover:bg-white"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">管理名</span>
                <input
                  className={inputClass}
                  value={form.name}
                  placeholder="HPあり: 乗り換え提案"
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </label>

              <div>
                <span className="block text-sm text-gray-700 mb-1">Book 名パターン</span>
                <input
                  className={inputClass}
                  value={form.bookNamePattern}
                  placeholder="GM\_%\_HPあり"
                  onChange={(e) => patch({ bookNamePattern: e.target.value })}
                />
                <div className="mt-1 flex flex-wrap gap-2">
                  {PATTERN_PRESETS.map((p) => (
                    <button
                      key={p.pattern}
                      type="button"
                      title={p.hint}
                      onClick={() => patch({ bookNamePattern: p.pattern })}
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 hover:border-blue-300"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  SQL の LIKE パターン。<code>%</code> は任意の文字列、
                  <code>\_</code> はリテラルのアンダースコアです。
                </p>
              </div>

              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">件名</span>
                <input
                  className={inputClass}
                  value={form.subject}
                  onChange={(e) => patch({ subject: e.target.value })}
                />
              </label>

              <label className="block">
                <span className="block text-sm text-gray-700 mb-1">本文</span>
                <textarea
                  className={`${inputClass} h-40 font-mono`}
                  value={form.body}
                  placeholder={"{{customer_name}} 様\n\nはじめまして。"}
                  onChange={(e) => patch({ body: e.target.value })}
                />
                <span className="block mt-1 text-xs text-gray-500">
                  {"{{customer_name}} / {{customer_corporation}} / {{customer_mail}} が使えます。配信停止リンクは自動で付きます。"}
                </span>
                {/* Phase 29b: この画面は Book 名パターンで対象を決めるため、
                    受信者が確定しておらず fields のキーを列挙できない。
                    使えること自体は案内する (プレビューでは空欄になる)。 */}
                <span className="block mt-1 text-xs text-gray-500">
                  {"CSV 取り込みで入った顧客ごとの差し込み変数 {{fields.<列名>}} も使えます (対象 Book が確定していないため、ここのプレビューでは空欄になります)。"}
                </span>
              </label>

              {/* 本文プレビュー (キャンペーン作成ウィザードと同じ置換ロジック) */}
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">プレビュー</p>
                <p className="text-sm font-medium text-gray-900">
                  {applyTemplate(form.subject, PREVIEW_VARS) || "(件名なし)"}
                </p>
                <pre className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">
                  {applyTemplate(form.body, PREVIEW_VARS) || "(本文なし)"}
                </pre>
              </div>

              {/* フォローアップ */}
              <div>
                <span className="block text-sm text-gray-700 mb-1">
                  フォローアップ ({form.followups.length}/{MAX_FOLLOWUPS})
                </span>
                {form.followups.map((f, i) => (
                  <div key={i} className="mb-2 rounded-lg border border-gray-200 bg-white p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">{i + 2} 通目 —</span>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={f.waitDays}
                        onChange={(e) =>
                          patch({
                            followups: form.followups.map((x, j) =>
                              j === i ? { ...x, waitDays: Number(e.target.value) } : x,
                            ),
                          })
                        }
                        className="w-20 rounded border border-gray-200 px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-gray-500">日後</span>
                      <button
                        type="button"
                        onClick={() =>
                          patch({ followups: form.followups.filter((_, j) => j !== i) })
                        }
                        className="ml-auto text-xs text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                    <input
                      className={`${inputClass} mb-1`}
                      placeholder="件名 (空なら Re: 1通目の件名)"
                      value={f.subject}
                      onChange={(e) =>
                        patch({
                          followups: form.followups.map((x, j) =>
                            j === i ? { ...x, subject: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <textarea
                      className={`${inputClass} h-24 font-mono`}
                      placeholder="本文"
                      value={f.body}
                      onChange={(e) =>
                        patch({
                          followups: form.followups.map((x, j) =>
                            j === i ? { ...x, body: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                {form.followups.length < MAX_FOLLOWUPS && (
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        followups: [...form.followups, { waitDays: 3, subject: "", body: "" }],
                      })
                    }
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:border-blue-300"
                  >
                    フォローアップを追加
                  </button>
                )}
              </div>

              {/* 送信元メールボックス */}
              <div>
                <span className="block text-sm text-gray-700 mb-1">送信元メールボックス</span>
                {mailboxes.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    利用できるメールボックスがありません (editor 以上の権限が必要)。
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                    {mailboxes.map((m) => {
                      const checked = form.mailboxIds.includes(m.id);
                      return (
                        <label key={m.id} className="flex items-center gap-2 text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              patch({
                                mailboxIds: checked
                                  ? form.mailboxIds.filter((x) => x !== m.id)
                                  : [...form.mailboxIds, m.id],
                              })
                            }
                          />
                          {m.address}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 送信ペーシング */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="block text-xs text-gray-600 mb-1">開始時 (JST)</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    className={inputClass}
                    value={form.sendStartHour}
                    onChange={(e) => patch({ sendStartHour: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-gray-600 mb-1">終了時 (JST)</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    className={inputClass}
                    value={form.sendEndHour}
                    onChange={(e) => patch({ sendEndHour: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-gray-600 mb-1">1日あたり上限/箱</span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    className={inputClass}
                    value={form.dailyCapPerMailbox}
                    onChange={(e) => patch({ dailyCapPerMailbox: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-gray-600 mb-1">送信間隔 (秒)</span>
                  <input
                    type="number"
                    min={10}
                    max={3600}
                    className={inputClass}
                    value={form.minIntervalSec}
                    onChange={(e) => patch({ minIntervalSec: Number(e.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-gray-600 mb-1">バウンス自動停止 (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={inputClass}
                    value={form.bouncePauseThreshold}
                    onChange={(e) => patch({ bouncePauseThreshold: Number(e.target.value) })}
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.warmupEnabled}
                    onChange={(e) => patch({ warmupEnabled: e.target.checked })}
                  />
                  ウォームアップ
                </label>
              </div>

              {/* 特定電子メール法の表示 */}
              <div className="space-y-2">
                <p className="text-sm text-gray-700">法定表示 (メール末尾に自動挿入)</p>
                <input
                  className={inputClass}
                  placeholder="会社名 / 氏名"
                  value={form.senderOrg}
                  onChange={(e) => patch({ senderOrg: e.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="住所"
                  value={form.senderAddress}
                  onChange={(e) => patch({ senderAddress: e.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="電話番号 / 問い合わせ先"
                  value={form.senderContact}
                  onChange={(e) => patch({ senderContact: e.target.value })}
                />
                <p className="text-xs text-gray-500">
                  未入力でも下書きは作られますが、開始時に必須チェックが入ります。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.trackOpens}
                    onChange={(e) => patch({ trackOpens: e.target.checked })}
                  />
                  開封を計測
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.trackClicks}
                    onChange={(e) => patch({ trackClicks: e.target.checked })}
                  />
                  クリックを計測
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => patch({ enabled: e.target.checked })}
                  />
                  このテンプレートを有効にする
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!canSave || isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSaving && <FiLoader className="w-4 h-4 animate-spin" />}
                  {isSaving ? "保存中..." : "保存"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-white"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
