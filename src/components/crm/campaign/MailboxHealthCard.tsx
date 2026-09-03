"use client";

// Phase 27f: 送信元メールボックスの健全性チェック。
// SPF/DKIM/DMARC/MX を DNS 実引きで点検し、直近 30 日のバウンス率・配信停止率と
// 合わせて good/warn/bad を判定する (CheckMailboxHealth)。
//
// DNS 引きに数秒かかるうえ毎回コストがかかるので、ページ表示時の自動実行はしない。
// ユーザーがボタンを押したときだけ叩く。

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FiActivity,
  FiAlertTriangle,
  FiCheck,
  FiLoader,
  FiX,
} from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import {
  type MailboxHealth,
  normalizeMailboxHealth,
  parseConnectError,
} from "@/lib/campaign";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

const GRADE_STYLES: Record<string, { label: string; className: string }> = {
  good: { label: "良好", className: "bg-green-100 text-green-800" },
  warn: { label: "要注意", className: "bg-amber-100 text-amber-800" },
  bad: { label: "要改善", className: "bg-red-100 text-red-800" },
};

function GradeBadge({ grade }: { grade: string }) {
  const style = GRADE_STYLES[grade] ?? {
    label: grade || "判定不能",
    className: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}

/** DNS 点検 1 行。値があれば等幅で表示 (長い TXT は省略 + title で全文)。 */
function DnsRow({
  label,
  ok,
  value,
  note,
}: {
  label: string;
  ok: boolean;
  value?: string;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="shrink-0 mt-0.5">
        {ok ? (
          <FiCheck className="w-4 h-4 text-green-600" />
        ) : (
          <FiX className="w-4 h-4 text-red-500" />
        )}
      </span>
      <span className="w-16 shrink-0 text-xs font-medium text-gray-700">{label}</span>
      <div className="min-w-0 flex-1">
        {value ? (
          <p
            className="font-mono text-xs text-gray-600 truncate"
            title={value}
          >
            {value}
          </p>
        ) : (
          <p className="text-xs text-gray-400">{ok ? "-" : "未設定"}</p>
        )}
        {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

export function MailboxHealthCard({ mailboxId }: { mailboxId: string }) {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [health, setHealth] = useState<MailboxHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    if (!accessToken || isChecking) return;
    setIsChecking(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/campaign.v1.CampaignService/CheckMailboxHealth`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mailboxId }),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(parseConnectError(text, response.status));
      }
      const data = await response.json();
      setHealth(normalizeMailboxHealth(data.health));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`健全性チェックに失敗しました: ${message}`);
      setHealth(null);
    } finally {
      setIsChecking(false);
    }
  };

  const rate = (v: number) => `${v.toFixed(1)}%`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={runCheck}
          disabled={isChecking || !accessToken}
        >
          {isChecking ? (
            <FiLoader className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <FiActivity className="w-4 h-4 mr-1" />
          )}
          {isChecking ? "DNS を確認中..." : health ? "再チェック" : "健全性チェック"}
        </Button>
        {health && <GradeBadge grade={health.grade} />}
        {health?.domain && (
          <span className="text-xs text-gray-500">{health.domain}</span>
        )}
      </div>

      {isChecking && !health && (
        <p className="text-xs text-gray-400">
          SPF/DKIM/DMARC/MX を問い合わせています (数秒かかります)
        </p>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {!health && !isChecking && !error && (
        <p className="text-xs text-gray-500">
          送信ドメインの DNS 設定 (SPF/DKIM/DMARC/MX) と直近 30 日の実績を確認します。
        </p>
      )}

      {health && (
        <div className="space-y-3">
          {/* DNS 点検 */}
          <div className="rounded-lg border bg-white px-3 py-2">
            <p className="text-xs font-medium text-gray-700 mb-1">DNS 設定</p>
            <div className="divide-y">
              <DnsRow label="SPF" ok={health.hasSpf} value={health.spf} />
              <DnsRow
                label="DKIM"
                ok={health.hasDkim}
                value={health.dkimSelector ? `selector: ${health.dkimSelector}` : ""}
              />
              <DnsRow
                label="DMARC"
                ok={health.hasDmarc}
                value={health.dmarc}
                note={
                  health.dmarcPolicy ? `ポリシー: ${health.dmarcPolicy}` : undefined
                }
              />
              <DnsRow label="MX" ok={health.hasMx} value={health.mxHost} />
            </div>
          </div>

          {/* 直近 30 日の実績 */}
          <div className="rounded-lg border bg-white px-3 py-2">
            <p className="text-xs font-medium text-gray-700 mb-2">直近30日の実績</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-md bg-gray-50 py-2">
                <p className="text-xs text-gray-500">送信</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">
                  {health.sent.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md bg-gray-50 py-2">
                <p className="text-xs text-gray-500">バウンス</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">
                  {health.bounced.toLocaleString()}
                  <span className="text-xs font-medium text-gray-500 ml-1">
                    ({rate(health.bounceRate)})
                  </span>
                </p>
              </div>
              <div className="rounded-md bg-gray-50 py-2">
                <p className="text-xs text-gray-500">配信停止</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">
                  {health.unsubscribed.toLocaleString()}
                  <span className="text-xs font-medium text-gray-500 ml-1">
                    ({rate(health.unsubscribeRate)})
                  </span>
                </p>
              </div>
              <div className="rounded-md bg-gray-50 py-2">
                <p className="text-xs text-gray-500">返信</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">
                  {health.replied.toLocaleString()}
                </p>
              </div>
            </div>
            {health.sent === 0 && (
              <p className="text-xs text-gray-400 mt-2">
                直近30日の送信実績がないため、率は参考になりません。
              </p>
            )}
          </div>

          {/* 指摘 */}
          {health.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <FiAlertTriangle className="w-3.5 h-3.5" />
                指摘事項
              </p>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-sm text-amber-800">
                {health.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MailboxHealthCard;
