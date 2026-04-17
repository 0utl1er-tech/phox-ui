"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FiMail, FiPlus, FiEdit2, FiTrash2, FiChevronDown } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import { TEMPLATE_PLACEHOLDERS } from "@/lib/mail-template";

interface MailTemplate {
  id: string;
  bookId: string;
  name: string;
  subject: string;
  body: string;
}

interface MailTemplateManagementProps {
  bookId: string;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

async function apiCall<T>(
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function rowToTemplate(row: any): MailTemplate {
  return {
    id: row?.id ?? "",
    bookId: row?.book_id ?? row?.bookId ?? "",
    name: row?.name ?? "",
    subject: row?.subject ?? "",
    body: row?.body ?? "",
  };
}

export default function MailTemplateManagement({ bookId }: MailTemplateManagementProps) {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<MailTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!accessToken || !bookId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiCall<{ templates?: any[] }>(
        "/mailtemplate.v1.MailTemplateService/ListMailTemplatesByBook",
        { book_id: bookId },
        accessToken,
      );
      setTemplates((data.templates ?? []).map(rowToTemplate));
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, bookId]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const handleOpenCreate = () => {
    setEditing({ id: "", bookId, name: "", subject: "", body: "" });
    setEditOpen(true);
  };

  const handleOpenEdit = (tpl: MailTemplate) => {
    setEditing({ ...tpl });
    setEditOpen(true);
  };

  const handleDelete = async (tpl: MailTemplate) => {
    if (!accessToken) return;
    if (!confirm(`「${tpl.name}」を削除します。よろしいですか？`)) return;
    try {
      await apiCall(
        "/mailtemplate.v1.MailTemplateService/DeleteMailTemplate",
        { id: tpl.id },
        accessToken,
      );
      await fetchTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    }
  };

  return (
    <>
      <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="flex items-center gap-2">
          <FiMail className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-lg text-gray-900">メールテンプレート</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={handleOpenCreate}
          >
            <FiPlus className="w-4 h-4 mr-1" />
            新規テンプレート
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="border rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">名前</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">件名</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider w-28">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-gray-500">
                      読み込み中...
                    </TableCell>
                  </TableRow>
                ) : templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-gray-500">
                      テンプレートがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((tpl) => (
                    <TableRow key={tpl.id}>
                      <TableCell className="font-medium">{tpl.name}</TableCell>
                      <TableCell className="text-gray-600">{tpl.subject || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`${tpl.name}を編集`}
                            onClick={() => handleOpenEdit(tpl)}
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`${tpl.name}を削除`}
                            onClick={() => void handleDelete(tpl)}
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <MailTemplateEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        bookId={bookId}
        initial={editing}
        onSaved={() => {
          void fetchTemplates();
          setEditOpen(false);
        }}
      />
    </>
  );
}

interface MailTemplateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  initial: MailTemplate | null;
  onSaved: () => void;
}

function MailTemplateEditDialog({
  open,
  onOpenChange,
  bookId,
  initial,
  onSaved,
}: MailTemplateEditDialogProps) {
  const accessToken = useAuthStore((s) => s.user?.accessToken);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // どちらの欄に変数を挿入するかを最後にフォーカスした欄で決定する。
  const [activeField, setActiveField] = useState<"subject" | "body">("body");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setSubject(initial?.subject ?? "");
      setBody(initial?.body ?? "");
      setError(null);
    }
  }, [open, initial]);

  const isNew = !initial?.id;

  const insertAtCursor = (field: "subject" | "body", token: string) => {
    if (field === "subject") {
      const el = subjectRef.current;
      if (!el) {
        setSubject((prev) => prev + token);
        return;
      }
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + token + el.value.slice(end);
      setSubject(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      const el = bodyRef.current;
      if (!el) {
        setBody((prev) => prev + token);
        return;
      }
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + token + el.value.slice(end);
      setBody(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    }
  };

  const handleSave = async () => {
    if (!accessToken) return;
    if (!name.trim()) {
      setError("テンプレート名は必須です");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await apiCall(
          "/mailtemplate.v1.MailTemplateService/CreateMailTemplate",
          { book_id: bookId, name: name.trim(), subject, body },
          accessToken,
        );
      } else {
        await apiCall(
          "/mailtemplate.v1.MailTemplateService/UpdateMailTemplate",
          { id: initial?.id, name: name.trim(), subject, body },
          accessToken,
        );
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{isNew ? "新規メールテンプレート" : "メールテンプレートを編集"}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="space-y-1">
            <label htmlFor="mt-name" className="text-sm font-medium text-gray-700">
              テンプレート名 <span className="text-red-600">*</span>
            </label>
            <Input
              id="mt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 初回アポイントのお礼"
              disabled={saving}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="mt-subject" className="text-sm font-medium text-gray-700">
                件名
              </label>
              <InsertVariableMenu
                onInsert={(tok) => insertAtCursor("subject", tok)}
                label="件名に変数を挿入"
              />
            </div>
            <Input
              id="mt-subject"
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setActiveField("subject")}
              disabled={saving}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="mt-body" className="text-sm font-medium text-gray-700">
                本文
              </label>
              <InsertVariableMenu
                onInsert={(tok) => insertAtCursor("body", tok)}
                label="本文に変数を挿入"
              />
            </div>
            <Textarea
              id="mt-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => setActiveField("body")}
              rows={12}
              disabled={saving}
            />
            <p className="text-xs text-gray-500">
              変数は送信時に実際の値で置換されます ({activeField === "body" ? "本文" : "件名"}にフォーカス中)
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InsertVariableMenu({
  onInsert,
  label,
}: {
  onInsert: (token: string) => void;
  label: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={label}>
          変数を挿入
          <FiChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {TEMPLATE_PLACEHOLDERS.map((key) => (
          <DropdownMenuItem
            key={key}
            onSelect={() => {
              onInsert(`{{${key}}}`);
            }}
          >
            {`{{${key}}}`}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
