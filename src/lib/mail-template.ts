// Phase 19: メールテンプレートのプレースホルダ置換ユーティリティ。
//
// テンプレート本文に `{{customer_name}}` 等のトークンを書いておくと、
// SendEmailDialog でテンプレを適用するときに現在の Customer / 自分の情報で
// 置換される。未定義のキーは空文字に置換する (ノイズを残さない)。

export const TEMPLATE_PLACEHOLDERS = [
  "customer_name",
  "customer_corporation",
  "customer_mail",
  "customer_phone",
  "sender_name",
  "sender_mail",
  "today",
] as const;

export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];

export type TemplateVars = Partial<Record<TemplatePlaceholder, string>>;

/** 1 つのトークン `{{key}}` を安全な正規表現に変換する。 */
function tokenRegex(key: string): RegExp {
  return new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
}

/**
 * テンプレ文字列を vars で置換する。未定義のキーは空文字に置換される。
 * 定義済みトークン以外はそのまま残す (誤記が視認できるように)。
 */
export function applyTemplate(tpl: string, vars: TemplateVars): string {
  let out = tpl;
  for (const key of TEMPLATE_PLACEHOLDERS) {
    const v = vars[key] ?? "";
    out = out.replace(tokenRegex(key), v);
  }
  return out;
}

/** "YYYY-MM-DD" 形式の今日 (JST 想定)。 */
export function todayJST(now: Date = new Date()): string {
  // toLocaleDateString で "2026/04/11" → ISO 風に整形
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
