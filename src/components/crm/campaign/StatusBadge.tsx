"use client";

// Phase 27a: キャンペーン/受信者ステータスのバッジ表示。

import type { CampaignStatus } from "@/lib/campaign";

const CAMPAIGN_STATUS_STYLES: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: "下書き", className: "bg-gray-100 text-gray-700" },
  running: { label: "実行中", className: "bg-green-100 text-green-800" },
  paused: { label: "一時停止", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "完了", className: "bg-blue-100 text-blue-800" },
  cancelled: { label: "中止", className: "bg-red-100 text-red-800" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const style = CAMPAIGN_STATUS_STYLES[status] ?? CAMPAIGN_STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}

const RECIPIENT_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  queued: { label: "待機中", className: "bg-gray-100 text-gray-700" },
  sending: { label: "送信中", className: "bg-blue-100 text-blue-800" },
  sent: { label: "送信済", className: "bg-green-100 text-green-800" },
  failed: { label: "失敗", className: "bg-red-100 text-red-800" },
  skipped: { label: "スキップ", className: "bg-yellow-100 text-yellow-800" },
};

export function RecipientStatusBadge({ status }: { status: string }) {
  const style = RECIPIENT_STATUS_STYLES[status] ?? {
    label: status || "-",
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
