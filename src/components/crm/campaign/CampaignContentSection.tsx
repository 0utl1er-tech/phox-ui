"use client";

// Phase 30: キャンペーン詳細の「配信内容」セクション。
// ステップ配信 (1 通目 + フォローアップ) の件名・待機日数・本文を閲覧し、
// draft / paused なら同じ場所で編集する。running 中は直接編集させず、
// 確認ダイアログ → PauseCampaign → 編集 → 「再開」の流れに一体化する。
// 件名ロック・ステップ削除ガードは backend (UpdateCampaign) と同じ
// stats.sent / stats.maxSentStep を見て UI 側でも先回りして止める。

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FiCheck, FiChevronRight, FiCopy, FiEdit2, FiPlay } from "react-icons/fi";
import { type Campaign, normalizeCampaign } from "@/lib/campaign";
import {
  buildSampleVars,
  effectiveStepSubject,
  renderCampaignPreview,
} from "@/lib/campaign-preview";
import {
  CampaignStepsEditor,
  type FollowupDraft,
  followupsValid,
} from "@/components/crm/campaign/CampaignStepsEditor";

interface CampaignContentSectionProps {
  campaign: Campaign;
  /** UpdateCampaign / PauseCampaign / StartCampaign を呼ぶ (詳細ページの callApi) */
  callApi: (method: string, payload: Record<string, unknown>) => Promise<any>;
  onCampaignChange: (c: Campaign) => void;
  senderName: string;
  senderMail: string;
}

interface StepView {
  stepNo: number;
  /** 2 通目以降のみ。前の送信からの待機日数。 */
  waitDays?: number;
  subject: string;
  body: string;
}

const COPIED_LABEL_MS = 2000;

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "unknown error";
}

export function CampaignContentSection({
  campaign,
  callApi,
  onCampaignChange,
  senderName,
  senderMail,
}: CampaignContentSectionProps) {
  const [showSample, setShowSample] = useState(false);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftFollowups, setDraftFollowups] = useState<FollowupDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // 保存直後の帯。paused なら「再開」ボタン付きで出す。
  const [savedNotice, setSavedNotice] = useState<"paused" | "saved" | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const steps = useMemo((): StepView[] => {
    return [
      { stepNo: 1, subject: campaign.subject, body: campaign.body },
      ...campaign.followups.map((f) => ({
        stepNo: f.stepNo,
        waitDays: f.waitDays,
        subject: f.subject,
        body: f.body,
      })),
    ];
  }, [campaign.subject, campaign.body, campaign.followups]);

  // 閲覧用のサンプル値 (受信者の実データは持たないので固定サンプル)
  const viewVars = useMemo(
    () =>
      buildSampleVars({
        senderName,
        senderMail,
        templates: steps.flatMap((s) => [s.subject, s.body]),
      }),
    [senderName, senderMail, steps],
  );

  // 編集中のプレビュー用 (下書きの参照キーで補完する)
  const editVars = useMemo(
    () =>
      buildSampleVars({
        senderName,
        senderMail,
        templates: [
          draftSubject,
          draftBody,
          ...draftFollowups.flatMap((f) => [f.subject, f.body]),
        ],
      }),
    [senderName, senderMail, draftSubject, draftBody, draftFollowups],
  );

  const display = (text: string) =>
    showSample ? renderCampaignPreview(text, viewVars) : text;

  const status = campaign.status;
  const isClosed = status === "completed" || status === "cancelled";
  const subjectLocked = campaign.stats.sent > 0;
  const hadFollowups = campaign.followups.length > 0;

  const enterEditMode = () => {
    setDraftSubject(campaign.subject);
    setDraftBody(campaign.body);
    setDraftFollowups(
      campaign.followups.map((f) => ({
        waitDays: f.waitDays,
        subject: f.subject,
        body: f.body,
      })),
    );
    setSaveError(null);
    setSavedNotice(null);
    setResumeError(null);
    setIsEditing(true);
  };

  const handleEditClick = () => {
    if (isClosed) return;
    if (status === "running") {
      setPauseError(null);
      setConfirmOpen(true);
      return;
    }
    enterEditMode();
  };

  const handlePauseAndEdit = async () => {
    if (isPausing) return;
    setIsPausing(true);
    setPauseError(null);
    try {
      const data = await callApi("PauseCampaign", { id: campaign.id });
      onCampaignChange(normalizeCampaign(data.campaign));
      setConfirmOpen(false);
      enterEditMode();
    } catch (e: unknown) {
      setPauseError(errorMessage(e));
    } finally {
      setIsPausing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const canSave =
    !isSaving && draftBody.trim().length > 0 && followupsValid(draftFollowups);

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, unknown> = { id: campaign.id, body: draftBody };
      // 送信済みの受信者がいると件名は変えられない (backend も拒否する)
      if (!subjectLocked) payload.subject = draftSubject;
      // 空配列は API 上「変更なし」なので送らない
      if (draftFollowups.length > 0) {
        payload.followups = draftFollowups.map((f) => ({
          wait_days: f.waitDays,
          subject: f.subject,
          body: f.body,
        }));
      }
      const data = await callApi("UpdateCampaign", payload);
      const updated = normalizeCampaign(data.campaign);
      onCampaignChange(updated);
      setIsEditing(false);
      setSavedNotice(updated.status === "paused" ? "paused" : "saved");
    } catch (e: unknown) {
      setSaveError(errorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResume = async () => {
    if (isResuming) return;
    setIsResuming(true);
    setResumeError(null);
    try {
      const data = await callApi("StartCampaign", { id: campaign.id });
      onCampaignChange(normalizeCampaign(data.campaign));
      setSavedNotice(null);
    } catch (e: unknown) {
      setResumeError(errorMessage(e));
    } finally {
      setIsResuming(false);
    }
  };

  const handleCopy = async (step: StepView, subjectText: string) => {
    const text = `件名: ${subjectText}\n\n${display(step.body)}`;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStep(step.stepNo);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedStep(null), COPIED_LABEL_MS);
    } catch {
      setCopyError("この環境ではクリップボードにコピーできません");
    }
  };

  // 再開ボタン付きの帯は、まだ paused のときだけ出す (ヘッダーから再開された等)
  const showPausedNotice = savedNotice === "paused" && status === "paused";
  const showSavedNotice = savedNotice === "saved";

  return (
    <section data-testid="campaign-content" className="bg-white border rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-base font-semibold text-gray-900">配信内容</h2>
        <div className="flex-1" />
        {!isEditing && (
          <>
            <div className="flex items-center gap-1.5">
              <input
                id="campaign-content-sample"
                type="checkbox"
                checked={showSample}
                onChange={(e) => setShowSample(e.target.checked)}
                className="h-4 w-4"
              />
              <label
                htmlFor="campaign-content-sample"
                className="text-sm text-gray-700 select-none cursor-pointer"
              >
                サンプル値で表示
              </label>
            </div>
            <span title={isClosed ? "完了・中止したキャンペーンは編集できません" : undefined}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEditClick}
                disabled={isClosed || isPausing}
                title={isClosed ? "完了・中止したキャンペーンは編集できません" : undefined}
              >
                <FiEdit2 className="w-4 h-4" />
                文面を編集
              </Button>
            </span>
          </>
        )}
      </div>

      {showPausedNotice && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-green-800">
            保存しました。配信を再開するには「再開」を押してください。
          </p>
          <div className="flex-1" />
          <Button
            type="button"
            size="sm"
            onClick={handleResume}
            disabled={isResuming}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <FiPlay className="w-4 h-4" />
            再開
          </Button>
        </div>
      )}
      {showSavedNotice && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">保存しました。</p>
        </div>
      )}
      {resumeError && <p className="text-sm text-red-600">{resumeError}</p>}

      {isEditing ? (
        <div className="space-y-3">
          <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                1通目
              </span>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="campaign-edit-subject">
                件名
              </label>
              <Input
                id="campaign-edit-subject"
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                disabled={subjectLocked || isSaving}
              />
              {subjectLocked && (
                <p className="text-xs text-gray-500">
                  送信済みの受信者がいるため、1通目の件名は変更できません
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="campaign-edit-body">
                本文 <span className="text-red-600">*</span>
              </label>
              <Textarea
                id="campaign-edit-body"
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={12}
                disabled={isSaving}
              />
            </div>
          </div>

          <CampaignStepsEditor
            followups={draftFollowups}
            onChange={setDraftFollowups}
            renderPreview={(text) => renderCampaignPreview(text, editVars)}
            lockedThroughStep={campaign.stats.maxSentStep}
            disallowEmpty={hadFollowups}
            disabled={isSaving}
          />

          {draftFollowups.length > 0 && (
            <p className="text-xs text-gray-500">
              待機日数を変えても、すでに送信予定が決まっている受信者の日時は変わりません。
            </p>
          )}

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}

          <div className="flex gap-2">
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              保存
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step) => {
            const rawSubject = effectiveStepSubject(step.stepNo, step.subject, campaign.subject);
            const isReply = step.stepNo >= 2 && step.subject.trim() === "";
            const subjectText = display(rawSubject);
            const copied = copiedStep === step.stepNo;
            return (
              <details
                key={step.stepNo}
                data-testid={`campaign-step-${step.stepNo}`}
                open={step.stepNo === 1}
                className="group border border-gray-200 rounded-lg"
              >
                <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-gray-50 rounded-lg">
                  <FiChevronRight className="w-4 h-4 text-gray-400 shrink-0 transition-transform group-open:rotate-90" />
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium shrink-0">
                    {step.stepNo}通目
                  </span>
                  {step.waitDays !== undefined && (
                    <span className="text-xs text-gray-500 shrink-0">
                      前の送信から{step.waitDays}日後
                    </span>
                  )}
                  <span className="text-sm text-gray-900 truncate min-w-0">
                    {subjectText || "(件名なし)"}
                  </span>
                </summary>
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-gray-100">
                  <div className="flex items-start gap-3 pt-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500">件名</p>
                      <p className="text-sm text-gray-900 break-words">
                        {subjectText || "(件名なし)"}
                        {isReply && (
                          <span className="text-xs text-gray-500 ml-1">
                            （1通目への返信として送信）
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCopy(step, subjectText)}
                      aria-label={`${step.stepNo}通目の文面をコピー`}
                      className="shrink-0"
                    >
                      {copied ? (
                        <FiCheck className="w-4 h-4 text-green-600" />
                      ) : (
                        <FiCopy className="w-4 h-4" />
                      )}
                      {copied ? "コピーしました" : "文面をコピー"}
                    </Button>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">本文</p>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap break-words mt-0.5">
                      {display(step.body) || "(本文なし)"}
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
          {copyError && <p className="text-sm text-red-600">{copyError}</p>}
        </div>
      )}

      <p className="text-xs text-gray-500">
        すべてのメールの末尾に送信者情報と配信停止 URL のフッターが自動で追記されます。
      </p>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isPausing) setConfirmOpen(open);
        }}
      >
        <DialogContent className="max-w-md" aria-labelledby="campaign-pause-dialog-title">
          <DialogHeader>
            <DialogTitle id="campaign-pause-dialog-title" className="text-lg">
              編集のため一時停止します
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3">
            <p className="text-sm text-gray-700">
              文面を編集するにはキャンペーンを一時停止します。送信中の 1 通は送り切ってから停止します。編集後に「再開」を押すと配信が再開されます。
            </p>
            {pauseError && <p className="text-sm text-red-600">{pauseError}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isPausing}
            >
              キャンセル
            </Button>
            <Button type="button" onClick={handlePauseAndEdit} disabled={isPausing}>
              一時停止して編集
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default CampaignContentSection;
