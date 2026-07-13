"use client";

// メールボックスの取込済みメッセージ一覧 (Phase 26)。
// 自分が viewer 以上の permit を持つメールボックスを選び、INBOX/Sent を
// Activity フィードと同じ要領で一覧する。行クリックで本文ダイアログ。
// mailbox-management と同じ手書き fetch パターン。

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { FiInbox, FiSend, FiPaperclip, FiX, FiUser } from "react-icons/fi";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";
const PAGE_SIZE = 50;

interface Mailbox {
  id: string;
  address: string;
  displayName: string;
}

interface MailMessage {
  id: string;
  folder: string;
  fromAddr: string;
  toAddrs: string;
  subject: string;
  attachmentNames: string;
  customerId?: string;
  occurredAt?: string;
  bodyText?: string;
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate(),
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function MailboxInbox() {
  const authUser = useAuthStore((s) => s.user);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [folder, setFolder] = useState<string>(""); // "" = 両方
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openMessage, setOpenMessage] = useState<MailMessage | null>(null);
  const [bodyLoading, setBodyLoading] = useState(false);

  const post = useCallback(
    async (path: string, body: object) => {
      const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authUser?.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      return res.json();
    },
    [authUser],
  );

  // メールボックス一覧 (viewer+ のもの)。
  useEffect(() => {
    if (!authUser) return;
    (async () => {
      try {
        const data = await post("/mailbox.v1.MailboxService/ListMailboxes", {});
        const list: Mailbox[] = (data.mailboxes || []).map((m: any) => ({
          id: m.id,
          address: m.address,
          displayName: m.displayName ?? "",
        }));
        setMailboxes(list);
        if (list.length > 0) setSelected((cur) => cur || list[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "メールボックスの取得に失敗しました");
      }
    })();
  }, [authUser, post]);

  // メッセージ一覧。
  const fetchMessages = useCallback(async () => {
    if (!authUser || !selected) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        mailbox_id: selected,
        limit: PAGE_SIZE,
        offset,
      };
      if (folder) body.folder = folder;
      const data = await post("/mailbox.v1.MailboxService/ListMailboxMessages", body);
      setMessages(
        (data.messages || []).map((m: any) => ({
          id: m.id,
          folder: m.folder,
          fromAddr: m.fromAddr ?? "",
          toAddrs: m.toAddrs ?? "",
          subject: m.subject ?? "",
          attachmentNames: m.attachmentNames ?? "",
          customerId: m.customerId,
          occurredAt: m.occurredAt,
        })),
      );
      setTotal(Number(data.total ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "メールの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [authUser, selected, folder, offset, post]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const openBody = async (msg: MailMessage) => {
    setOpenMessage(msg);
    setBodyLoading(true);
    try {
      const data = await post("/mailbox.v1.MailboxService/GetMailboxMessage", { id: msg.id });
      setOpenMessage({ ...msg, bodyText: data.message?.bodyText ?? "" });
    } catch (e) {
      setOpenMessage({ ...msg, bodyText: "(本文の取得に失敗しました)" });
    } finally {
      setBodyLoading(false);
    }
  };

  if (mailboxes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FiInbox className="w-5 h-5" />
            メール
          </CardTitle>
          <CardDescription>
            閲覧できるメールボックスがありません。設定画面でメールボックスを登録するか、owner に
            アクセス権を付与してもらってください。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FiInbox className="w-5 h-5" />
          メール
        </CardTitle>
        <CardDescription>
          Phox が取込んだメールボックスの送受信メール。顧客に紐付かない新規の問い合わせも含まれます。
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setOffset(0);
            }}
          >
            {mailboxes.map((mb) => (
              <option key={mb.id} value={mb.id}>
                {mb.displayName ? `${mb.displayName} <${mb.address}>` : mb.address}
              </option>
            ))}
          </select>
          <div className="flex gap-1">
            {[
              { v: "", label: "すべて" },
              { v: "INBOX", label: "受信" },
              { v: "Sent", label: "送信" },
            ].map((f) => (
              <Button
                key={f.v}
                size="sm"
                variant={folder === f.v ? "default" : "outline"}
                onClick={() => {
                  setFolder(f.v);
                  setOffset(0);
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        {loading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500">メールがありません (取込みは数十秒ごとに実行されます)。</p>
        ) : (
          <div className="divide-y">
            {messages.map((m) => (
              <button
                key={m.id}
                className="w-full text-left py-2 px-1 hover:bg-gray-50 flex items-start gap-2"
                onClick={() => openBody(m)}
              >
                <span className="mt-0.5 text-gray-400">
                  {m.folder === "Sent" ? <FiSend className="w-4 h-4" /> : <FiInbox className="w-4 h-4" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {m.folder === "Sent" ? m.toAddrs : m.fromAddr}
                    </span>
                    {m.customerId ? (
                      <Badge variant="secondary" className="shrink-0">
                        <FiUser className="w-3 h-3 mr-1" />
                        顧客
                      </Badge>
                    ) : (
                      m.folder !== "Sent" && (
                        <Badge variant="outline" className="shrink-0 text-amber-700 border-amber-300">
                          未登録
                        </Badge>
                      )
                    )}
                    {m.attachmentNames && <FiPaperclip className="w-3 h-3 text-gray-400 shrink-0" />}
                  </span>
                  <span className="block text-sm text-gray-700 truncate">{m.subject || "(件名なし)"}</span>
                </span>
                <span className="text-xs text-gray-400 shrink-0 mt-1">{fmtDate(m.occurredAt)}</span>
              </button>
            ))}
          </div>
        )}

        {/* ページング */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total} 件
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                前へ
              </Button>
              <Button size="sm" variant="outline" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                次へ
              </Button>
            </div>
          </div>
        )}

        {/* 本文ダイアログ */}
        {openMessage && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpenMessage(null)}>
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between p-4 border-b">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{openMessage.subject || "(件名なし)"}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    From: {openMessage.fromAddr} / To: {openMessage.toAddrs}
                    <span className="ml-2">{fmtDate(openMessage.occurredAt)}</span>
                  </p>
                  {openMessage.attachmentNames && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <FiPaperclip className="w-3 h-3" />
                      {openMessage.attachmentNames}
                    </p>
                  )}
                  {openMessage.customerId && (
                    <Link href={`/customer/${openMessage.customerId}`} className="text-xs text-blue-600 underline">
                      顧客ページを開く
                    </Link>
                  )}
                </div>
                <button className="text-gray-400 hover:text-gray-600 shrink-0 ml-2" onClick={() => setOpenMessage(null)}>
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                {bodyLoading ? (
                  <p className="text-sm text-gray-500">本文を読み込み中...</p>
                ) : (
                  <pre className="text-sm whitespace-pre-wrap font-sans">{openMessage.bodyText || "(本文なし)"}</pre>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
