"use client";

// Phase 30: フォローアップ (2 通目以降) の入力欄。作成画面 (/campaigns/new) の
// 入力部を切り出したもので、詳細ページの文面編集でも使う。
// 見出し・説明文は呼び出し側が持つ (作成画面と編集で文脈が違うため)。

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FiPlus, FiTrash2 } from "react-icons/fi";

/** Phase 27e: フォローアップの入力ドラフト。stepNo は送信不要 (自動採番)。 */
export interface FollowupDraft {
  waitDays: number;
  subject: string;
  body: string;
}

export const MAX_FOLLOWUPS = 5;

/** 全フォローアップの本文が入っていて、待機日数が 1〜60 の範囲か。 */
export function followupsValid(followups: FollowupDraft[]): boolean {
  return followups.every(
    (f) =>
      f.body.trim().length > 0 &&
      Number.isFinite(f.waitDays) &&
      f.waitDays >= 1 &&
      f.waitDays <= 60,
  );
}

interface CampaignStepsEditorProps {
  followups: FollowupDraft[];
  onChange: (next: FollowupDraft[]) => void;
  renderPreview: (text: string) => string;
  /**
   * この通数以下のステップは削除不可 (= campaign.stats.maxSentStep)。
   * 該当ステップの削除ボタンを disabled にし title で理由を出す。
   */
  lockedThroughStep?: number;
  /** true なら最後の 1 通の削除を禁止する (編集時: API が全削除を表現できない) */
  disallowEmpty?: boolean;
  disabled?: boolean;
}

export function CampaignStepsEditor({
  followups,
  onChange,
  renderPreview,
  lockedThroughStep = 0,
  disallowEmpty = false,
  disabled = false,
}: CampaignStepsEditorProps) {
  const addFollowup = () => {
    if (followups.length >= MAX_FOLLOWUPS) return;
    onChange([...followups, { waitDays: 3, subject: "", body: "" }]);
  };
  const updateFollowup = (index: number, patch: Partial<FollowupDraft>) => {
    onChange(followups.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };
  const removeFollowup = (index: number) => {
    onChange(followups.filter((_, i) => i !== index));
  };

  // 削除できない理由 (null = 削除可)。送信済みロックを優先して出す。
  const removeBlockedReason = (stepNo: number): string | null => {
    if (stepNo <= lockedThroughStep) {
      return `${stepNo}通目は送信済みの受信者がいるため削除できません`;
    }
    if (disallowEmpty && followups.length <= 1) {
      return "フォローアップを 0 通にはできません";
    }
    return null;
  };

  return (
    <>
      {followups.map((f, i) => {
        const stepNo = i + 2;
        const blockedReason = removeBlockedReason(stepNo);
        return (
          <div
            key={i}
            className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50"
          >
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                {stepNo}通目
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
                  aria-label={`${stepNo}通目の待機日数`}
                  className="w-20 inline-block"
                  disabled={disabled}
                />
                日後、返信がなければ送信
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => removeFollowup(i)}
                className="p-1.5 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                title={blockedReason ?? `${stepNo}通目を削除`}
                aria-label={`${stepNo}通目を削除`}
                disabled={disabled || blockedReason !== null}
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
                disabled={disabled}
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
                disabled={disabled}
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
        );
      })}

      {followups.length < MAX_FOLLOWUPS ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addFollowup}
          disabled={disabled}
        >
          <FiPlus className="w-4 h-4 mr-1" />
          フォローアップを追加
          {followups.length > 0 && ` (${followups.length}/${MAX_FOLLOWUPS})`}
        </Button>
      ) : (
        <p className="text-xs text-gray-500">
          フォローアップは最大 {MAX_FOLLOWUPS} 通までです
        </p>
      )}
    </>
  );
}

export default CampaignStepsEditor;
