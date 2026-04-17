"use client";

// SendEmailDialog — 顧客詳細画面から「メール送信」を開始する Dialog。
// backend に CreateActivityEmailSent を叩いて SMTP 送信 + Activity 記録を行う。
//
// 送信元 (From) は Keycloak アクセストークンの email claim を backend 側で
// 抽出して使うので、この Dialog では From は表示しない。
// 送信先 (To) の候補は Customer.mail + Contact.mail の UNION。

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/authStore";
import {
  applyTemplate,
  todayJST,
  type TemplateVars,
} from "@/lib/mail-template";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  /** Book ID — メールテンプレ一覧の fetch 用。未指定ならテンプレ機能は無効。 */
  bookId?: string;
  customerMail?: string;
  /** テンプレの vars に使う Customer 側情報 */
  customerName?: string;
  customerCorporation?: string;
  customerPhone?: string;
  onSent?: () => void;
}

interface MailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface Contact {
  id: string;
  name: string;
  mail: string;
}

interface ToOption {
  label: string;
  value: string;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  customerId,
  bookId,
  customerMail,
  customerName,
  customerCorporation,
  customerPhone,
  onSent,
}: SendEmailDialogProps) {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const senderName = useAuthStore((s) => s.user?.name ?? "");
  const senderMail = useAuthStore((s) => s.user?.email ?? "");

  const [toOptions, setToOptions] = useState<ToOption[]>([]);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Dialog を閉じたらリセット
  useEffect(() => {
    if (!open) {
      setTo("");
      setCc("");
      setSubject("");
      setBody("");
      setIsSubmitting(false);
      setError(null);
      setSelectedTemplateId("");
      setTemplates([]);
    }
  }, [open]);

  // 開いたときに Book のテンプレ一覧を fetch
  useEffect(() => {
    if (!open || !accessToken || !bookId) return;
    const load = async () => {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
      try {
        const response = await fetch(
          `${apiUrl}/mailtemplate.v1.MailTemplateService/ListMailTemplatesByBook`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ book_id: bookId }),
          },
        );
        if (!response.ok) return;
        const data = await response.json();
        const list: MailTemplate[] = (data.templates ?? []).map((t: any) => ({
          id: t.id ?? "",
          name: t.name ?? "",
          subject: t.subject ?? "",
          body: t.body ?? "",
        }));
        setTemplates(list);
      } catch (e) {
        console.error("fetch mail templates failed", e);
      }
    };
    void load();
  }, [open, accessToken, bookId]);

  const buildVars = (): TemplateVars => ({
    customer_name: customerName ?? "",
    customer_corporation: customerCorporation ?? "",
    customer_mail: customerMail ?? "",
    customer_phone: customerPhone ?? "",
    sender_name: senderName,
    sender_mail: senderMail,
    today: todayJST(),
  });

  const handleApplyTemplate = () => {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;
    const vars = buildVars();
    setSubject(applyTemplate(tpl.subject, vars));
    setBody(applyTemplate(tpl.body, vars));
  };

  // 開いたときに Contact 一覧 + Customer.mail を組み立てる
  useEffect(() => {
    if (!open || !accessToken || !customerId) return;

    const load = async () => {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
      try {
        const response = await fetch(`${apiUrl}/contact.v1.ContactService/ListContact`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ customer_id: customerId }),
        });
        const options: ToOption[] = [];
        if (customerMail) {
          options.push({ label: `顧客 <${customerMail}>`, value: customerMail });
        }
        if (response.ok) {
          const data = await response.json();
          const contacts: Contact[] = (data.contacts ?? []).map((c: any) => ({
            id: c.id ?? "",
            name: c.name ?? "",
            mail: c.mail ?? "",
          }));
          for (const c of contacts) {
            if (c.mail) {
              options.push({
                label: `${c.name || "(名前なし)"} <${c.mail}>`,
                value: c.mail,
              });
            }
          }
        }
        setToOptions(options);
        if (options.length > 0 && !to) {
          setTo(options[0].value);
        }
      } catch (e) {
        console.error("fetch contacts for SendEmailDialog failed", e);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accessToken, customerId, customerMail]);

  const canSubmit = useMemo(
    () => to.trim().length > 0 && subject.trim().length > 0 && !isSubmitting,
    [to, subject, isSubmitting],
  );

  const handleSubmit = async () => {
    if (!canSubmit || !accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
      const payload: Record<string, unknown> = {
        customer_id: customerId,
        mail_to: to.trim(),
        subject: subject.trim(),
        body: body,
      };
      if (cc.trim()) {
        payload.mail_cc = cc.trim();
      }
      const response = await fetch(
        `${apiUrl}/activity.v1.ActivityService/CreateActivityEmailSent`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        if (response.status === 403) {
          throw new Error("この Book に書き込む権限がありません");
        }
        if (response.status === 412 || text.includes("failed_precondition")) {
          throw new Error(
            "あなたのメールアドレスが Keycloak プロフィールに設定されていません。設定画面から追加してください。",
          );
        }
        if (response.status === 503) {
          throw new Error("SMTP サーバーが利用できません (backend の設定を確認)");
        }
        throw new Error(text || `HTTP ${response.status}`);
      }
      onSent?.();
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setError(`送信に失敗しました: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const noRecipients = toOptions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>メール送信</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {noRecipients && !customerMail && (
            <p className="text-sm text-gray-600">
              この顧客に紐づくメールアドレスがありません。連絡先を追加するか、
              顧客情報にメールアドレスを設定してください。
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="send-email-to" className="text-sm font-medium text-gray-700">
              宛先 (To) <span className="text-red-600">*</span>
            </label>
            {toOptions.length > 0 && (
              <select
                aria-label="宛先候補"
                value={toOptions.find((o) => o.value === to) ? to : ""}
                onChange={(e) => setTo(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {toOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <Input
              id="send-email-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="send-email-cc" className="text-sm font-medium text-gray-700">
              CC
            </label>
            <Input
              id="send-email-cc"
              type="email"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="(optional)"
              disabled={isSubmitting}
            />
          </div>

          {templates.length > 0 && (
            <div className="space-y-1 rounded-md bg-blue-50 border border-blue-100 p-2">
              <label htmlFor="send-email-template" className="text-sm font-medium text-gray-700">
                テンプレートを適用
              </label>
              <div className="flex gap-2">
                <select
                  id="send-email-template"
                  aria-label="テンプレート選択"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">(選択なし)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyTemplate}
                  disabled={!selectedTemplateId || isSubmitting}
                >
                  適用
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                変数はこの顧客の情報で置換されます
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="send-email-subject" className="text-sm font-medium text-gray-700">
              件名 <span className="text-red-600">*</span>
            </label>
            <Input
              id="send-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="send-email-body" className="text-sm font-medium text-gray-700">
              本文
            </label>
            <Textarea
              id="send-email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            キャンセル
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "送信中..." : "送信"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
