// Phase 30: キャンペーン文面のプレビュー用ヘルパー。
// 作成画面 (/campaigns/new) と詳細ページの配信内容セクションで共用する。
// 差し込みの意味論は applyTemplate (= backend internal/campaign.Render) に従う。

import {
  applyTemplate,
  referencedFieldKeys,
  todayJST,
  type TemplateVars,
} from "@/lib/mail-template";

export interface SamplePreviewInput {
  senderName: string;
  senderMail: string;
  /** 受信者の実データがあれば (作成画面)。無ければ固定サンプル。 */
  customerName?: string;
  customerEmail?: string;
  /** 受信者の custom_fields サンプル (作成画面のみ)。 */
  fieldSample?: Record<string, string>;
  /** 参照キーの補完に使う本文群 (件名+本文すべて)。 */
  templates: string[];
}

/**
 * プレビュー用の差し込み値を作る。
 * 本文が参照しているのに実データが無い {{fields.x}} は、空文字で消えると
 * 「書いたのに出ない」のか「差し込みが壊れている」のか区別が付かないため
 * `(サンプル: x)` を置く (backend のテスト送信と同じ方針)。
 */
export function buildSampleVars(input: SamplePreviewInput): TemplateVars {
  const fields: Record<string, string> = { ...(input.fieldSample ?? {}) };
  for (const key of referencedFieldKeys(input.templates.join("\n"))) {
    if (!fields[key]) fields[key] = `(サンプル: ${key})`;
  }
  return {
    customer_name: input.customerName || "山田 太郎",
    customer_corporation: "株式会社サンプル",
    customer_mail: input.customerEmail || "taro@example.com",
    customer_phone: "03-0000-0000",
    sender_name: input.senderName,
    sender_mail: input.senderMail,
    today: todayJST(),
    fields,
  };
}

/** applyTemplate + {{unsubscribe_url}} を実送信時に挿入される旨のダミー URL に置換する。 */
export function renderCampaignPreview(text: string, vars: TemplateVars): string {
  return applyTemplate(text, vars).replace(
    /\{\{\s*unsubscribe_url\s*\}\}/g,
    "https://.../u/xxxxx (実送信時に挿入)",
  );
}

/** 2 通目以降で件名が空なら "Re: <1 通目の件名>" を返す (worker と同じ規則)。 */
export function effectiveStepSubject(
  stepNo: number,
  subject: string,
  firstSubject: string,
): string {
  if (stepNo >= 2 && subject.trim() === "") return `Re: ${firstSubject}`;
  return subject;
}
