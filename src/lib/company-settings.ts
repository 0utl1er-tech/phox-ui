// Phase 27f: company.v1.CompanyService — 会社単位の管理者設定 (通話記録モード)。
//
// 通話記録モード:
//   'click' … 従来どおり。電話番号クリック時、Zoom API 発信に失敗した
//             フォールバック経路でもコール活動を自動記録する (デフォルト)。
//   'zoom'  … Zoom 通話履歴をマスターにする。フォールバックでは発信のみ
//             (自動記録なし)。実際の通話は backend の毎時リコンシリエーション
//             + webhook で Zoom から同期される。
//
// getCallLogMode は phone-input のクリックハンドラから毎回呼ばれるため、
// モジュールスコープで fetch-once キャッシュする (同時多発クリックも
// in-flight Promise を共有)。設定画面で更新したら
// invalidateCompanySettingsCache() でキャッシュを破棄すること。

export type CallLogMode = "click" | "zoom";

export interface CompanySettings {
  callLogMode: CallLogMode;
  canEdit: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

let cache: CompanySettings | null = null;
let inflight: Promise<CompanySettings> | null = null;

/** Connect JSON は snake_case / camelCase どちらでも返り得るので両対応で読む。 */
function normalizeCompanySettings(data: Record<string, unknown>): CompanySettings {
  const rawMode = (data.callLogMode ?? data.call_log_mode ?? "click") as string;
  return {
    callLogMode: rawMode === "zoom" ? "zoom" : "click",
    canEdit: Boolean(data.canEdit ?? data.can_edit ?? false),
  };
}

/**
 * 会社設定を取得する (モジュールキャッシュ付き)。失敗時は throw。
 * 設定画面など canEdit も必要な場面向け。
 */
export async function fetchCompanySettings(token: string): Promise<CompanySettings> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetch(`${API_URL}/company.v1.CompanyService/GetSettings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(`GetSettings failed: HTTP ${response.status}`);
      }
      const data = await response.json();
      cache = normalizeCompanySettings(data ?? {});
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * 通話記録モードだけ欲しい場面向け (phone-input のフォールバック判定)。
 * 取得に失敗した場合は従来挙動の 'click' にフォールバックする
 * (記録しない側に倒すより、従来どおり記録する側に倒す方が安全)。
 */
export async function getCallLogMode(token: string): Promise<CallLogMode> {
  try {
    const settings = await fetchCompanySettings(token);
    return settings.callLogMode;
  } catch {
    return "click";
  }
}

/** 設定更新後に呼び、次回取得で最新値を読み直させる。 */
export function invalidateCompanySettingsCache(): void {
  cache = null;
  inflight = null;
}
