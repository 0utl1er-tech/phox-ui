"use client";

// Phase 27d: Instantly 風の日次折れ線チャート (ハンドロール SVG)。
// 系列: 送信/開封/クリック/返信。凡例クリックで表示トグル、
// ホバーで縦ガイド + ツールチップ (値と送信比 %)。

import { useMemo, useRef, useState } from "react";
import type { CampaignDailyStat } from "@/lib/campaign";

const SERIES = [
  { key: "sent", label: "送信", color: "#6366f1" },
  { key: "opened", label: "開封", color: "#0ea5e9" },
  { key: "clicked", label: "クリック", color: "#0d9488" },
  { key: "replied", label: "返信", color: "#16a34a" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

// viewBox 座標系 (レスポンシブは width:100% + viewBox で実現)
const VB_W = 800;
const VB_H = 280;
const M_LEFT = 44;
const M_RIGHT = 16;
const M_TOP = 12;
const M_BOTTOM = 26;
const PLOT_W = VB_W - M_LEFT - M_RIGHT;
const PLOT_H = VB_H - M_TOP - M_BOTTOM;

/** "YYYY-MM-DD" → "M/D"。 */
function shortDate(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${Number(m[1])}/${Number(m[2])}`;
}

/** 最大値をキリのよい値 (1/2/5 × 10^n) に切り上げ。 */
function niceCeil(v: number): number {
  if (v <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const step of [1, 2, 4, 5, 10]) {
    if (v <= step * pow) return step * pow;
  }
  return 10 * pow;
}

/** Catmull-Rom → cubic bezier の滑らかなパス。 */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const clampY = (y: number) => Math.min(M_TOP + PLOT_H, Math.max(M_TOP, y));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

// 表示期間プリセット。0 = 全期間。デフォルトは直近 7 日
// (数日分のデータが全幅に引き伸ばされる「極端」な見た目を避ける)。
const RANGE_PRESETS = [
  { label: "7日", value: 7 },
  { label: "14日", value: 14 },
  { label: "30日", value: 30 },
  { label: "全期間", value: 0 },
] as const;

export function CampaignChart({ days: allDays }: { days: CampaignDailyStat[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<SeriesKey>>(new Set());
  const [rangeDays, setRangeDays] = useState<number>(7);
  // hover: データ点 index + コンテナ内 px 座標 (ツールチップ配置用)
  const [hover, setHover] = useState<{ index: number; px: number; width: number } | null>(null);

  // 直近 N 日にスライス (allDays は 0 埋め済み・昇順・今日まで)。
  const days = useMemo(
    () => (rangeDays === 0 ? allDays : allDays.slice(-rangeDays)),
    [allDays, rangeDays],
  );

  const totals = useMemo(() => {
    const t: Record<SeriesKey, number> = { sent: 0, opened: 0, clicked: 0, replied: 0 };
    for (const d of days) {
      t.sent += d.sent;
      t.opened += d.opened;
      t.clicked += d.clicked;
      t.replied += d.replied;
    }
    return t;
  }, [days]);

  const n = days.length;

  const yMax = useMemo(() => {
    let max = 0;
    for (const d of days) {
      for (const s of SERIES) {
        if (!hiddenKeys.has(s.key)) max = Math.max(max, d[s.key]);
      }
    }
    return niceCeil(max);
  }, [days, hiddenKeys]);

  const xAt = (i: number) =>
    n <= 1 ? M_LEFT + PLOT_W / 2 : M_LEFT + (i / (n - 1)) * PLOT_W;
  const yAt = (v: number) => M_TOP + PLOT_H * (1 - v / yMax);

  const toggleSeries = (key: SeriesKey) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleMove = (e: React.MouseEvent) => {
    const el = wrapRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    // px → viewBox x → 最寄りのデータ点 index
    const vx = (px / rect.width) * VB_W;
    const frac = n <= 1 ? 0 : (vx - M_LEFT) / PLOT_W;
    const index = Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1))));
    setHover({ index, px, width: rect.width });
  };

  if (n === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400">
        まだ送信データがありません
      </div>
    );
  }

  // 横軸ラベルの間引き (最大 8 個程度)
  const labelStep = Math.max(1, Math.ceil(n / 8));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));

  const hoverDay = hover ? days[hover.index] : null;
  // ツールチップは右側に出し、右端に近いときは左側へ反転
  const tooltipLeft = hover ? hover.px < hover.width * 0.6 : true;

  const pct = (v: number, sent: number) =>
    sent > 0 ? ` (${Math.round((v / sent) * 100)}%)` : "";

  return (
    <div>
      {/* 凡例 (クリックでトグル) + 表示期間セレクタ */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
        {SERIES.map((s) => {
          const off = hiddenKeys.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              className={`flex items-center gap-1.5 text-sm transition-opacity ${off ? "opacity-35" : ""}`}
              title={off ? "クリックで表示" : "クリックで非表示"}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-gray-600">{s.label}</span>
              <span className="font-semibold text-gray-900 tabular-nums">
                {totals[s.key].toLocaleString()}
              </span>
            </button>
          );
        })}
        </div>

        {/* 表示期間 (デフォルト直近7日) */}
        <div className="flex items-center rounded-lg border bg-gray-50 p-0.5">
          {RANGE_PRESETS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRangeDays(r.value)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                rangeDays === r.value
                  ? "bg-white text-gray-900 font-medium shadow-sm border"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto block"
          role="img"
          aria-label="日次送信・エンゲージメント推移"
        >
          <defs>
            <linearGradient id="campaign-chart-sent-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* 横グリッド + Y ラベル */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={M_LEFT}
                x2={VB_W - M_RIGHT}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray={tick === 0 ? undefined : "3 3"}
              />
              <text
                x={M_LEFT - 8}
                y={yAt(tick) + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="#9ca3af"
              >
                {tick.toLocaleString()}
              </text>
            </g>
          ))}

          {/* X ラベル (間引き) */}
          {days.map((d, i) =>
            i % labelStep === 0 || i === n - 1 ? (
              <text
                key={d.date}
                x={xAt(i)}
                y={VB_H - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#9ca3af"
              >
                {shortDate(d.date)}
              </text>
            ) : null,
          )}

          {/* 送信系列のエリア塗り */}
          {!hiddenKeys.has("sent") && n > 1 && (
            <path
              d={`${smoothPath(days.map((d, i) => ({ x: xAt(i), y: yAt(d.sent) })))} L${xAt(n - 1)},${M_TOP + PLOT_H} L${xAt(0)},${M_TOP + PLOT_H} Z`}
              fill="url(#campaign-chart-sent-fill)"
              stroke="none"
            />
          )}

          {/* ホバー縦ガイド */}
          {hover && (
            <line
              x1={xAt(hover.index)}
              x2={xAt(hover.index)}
              y1={M_TOP}
              y2={M_TOP + PLOT_H}
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          )}

          {/* 折れ線 + データ点 */}
          {SERIES.map((s) => {
            if (hiddenKeys.has(s.key)) return null;
            const pts = days.map((d, i) => ({ x: xAt(i), y: yAt(d[s.key]) }));
            return (
              <g key={s.key}>
                {n > 1 && (
                  <path
                    d={smoothPath(pts)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={hover?.index === i ? 4 : 2.5}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {/* ツールチップ (div オーバーレイ) */}
        {hover && hoverDay && (
          <div
            className="absolute top-2 z-10 pointer-events-none bg-gray-900/90 text-white rounded-lg px-3 py-2 text-xs shadow-lg whitespace-nowrap"
            style={
              tooltipLeft
                ? { left: hover.px + 12 }
                : { right: hover.width - hover.px + 12 }
            }
          >
            <p className="font-semibold mb-1">{hoverDay.date}</p>
            {SERIES.filter((s) => !hiddenKeys.has(s.key)).map((s) => (
              <p key={s.key} className="flex items-center gap-1.5 tabular-nums">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.label} {hoverDay[s.key].toLocaleString()}
                {s.key !== "sent" && pct(hoverDay[s.key], hoverDay.sent)}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
