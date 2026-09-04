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

export type TemplateVars = Partial<Record<TemplatePlaceholder, string>> & {
  /**
   * Phase 29b: 顧客ごとの任意差し込み変数 (Customer.custom_fields)。
   * 本文では `{{fields.<key>}}` で参照する。キーは英小文字/数字/
   * アンダースコアのみ (CSV 取り込み時に正規化される)。
   */
  fields?: Record<string, string>;
};

/** 差し込み変数キーの字種 (backend internal/customfields.ValidKey と同一)。 */
export const FIELD_KEY_PATTERN = /^[a-z0-9_]{1,64}$/;

export function isValidFieldKey(key: string): boolean {
  return FIELD_KEY_PATTERN.test(key);
}

/**
 * 任意の文字列 (CSV の列名など) を差し込み変数キーに正規化する。
 * backend internal/customfields.NormalizeKey と同じ規則:
 * 小文字化 → トリム → [a-z0-9_] 以外は '_' → 64 文字で切り詰め。
 * 有効な文字が 1 つも無ければ null (キーにできない)。
 */
export function normalizeFieldKey(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const key = s.slice(0, 64).replace(/[^a-z0-9_]/g, "_");
  return /[a-z0-9]/.test(key) ? key : null;
}

// 本文中の {{ ... }} を 1 パスで拾う (backend internal/campaign.tokenRegexp と同型)。
// 中身を「} と空白以外」まで広く取るのは、{{fields.meo-score}} のような
// 書き間違いもトークンとして認識して消すため。
const TOKEN_RE = /\{\{\s*([^}\s]{1,128})\s*\}\}/g;

/**
 * テンプレ文字列を vars で置換する。backend の internal/campaign.Render と
 * 同じセマンティクスを保つこと (プレビューと実送信がズレると事故になる)。
 *
 * - 定義済みキー: 未定義なら空文字。
 * - `{{fields.<key>}}`: vars.fields から引く。キーが無い/字種違反でも空文字
 *   (本文に `{{fields.x}}` が残って受信者に届くのを防ぐ)。
 * - それ以外のトークンはそのまま残す (誤記が視認できるように)。
 *
 * 置換は 1 パス — 差し込んだ値の中の `{{...}}` は再展開しない
 * (値は顧客由来 = 外部入力なので、二次展開はテンプレート注入になる)。
 */
export function applyTemplate(tpl: string, vars: TemplateVars): string {
  const fixed = new Set<string>(TEMPLATE_PLACEHOLDERS);
  return tpl.replace(TOKEN_RE, (token, key: string) => {
    if (fixed.has(key)) {
      return vars[key as TemplatePlaceholder] ?? "";
    }
    if (key.startsWith("fields.")) {
      return vars.fields?.[key.slice("fields.".length)] ?? "";
    }
    return token;
  });
}

/**
 * テンプレートが参照している差し込み変数キーを出現順・重複排除で返す
 * (字種違反のものは除く)。backend の campaign.ReferencedFieldKeys と同じ。
 */
export function referencedFieldKeys(tpl: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of tpl.matchAll(TOKEN_RE)) {
    const key = m[1];
    if (!key.startsWith("fields.")) continue;
    const name = key.slice("fields.".length);
    if (!isValidFieldKey(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
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
