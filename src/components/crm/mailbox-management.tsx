"use client";

// 会社共有メールボックス (Phox が所有する実メールアドレス) の管理。
// Book の user-access-management と同じ手書き fetch + RBAC パターン。
// メールボックスは company レベル、MailboxPermit(owner/editor/viewer) で
// 誰が使えるかを制御する。パスワードは書き込み専用 (表示しない)。

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { FiMail, FiPlus, FiTrash2, FiUsers, FiChevronDown, FiChevronRight } from "react-icons/fi";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

interface Mailbox {
  id: string;
  address: string;
  displayName: string;
  active: boolean;
  role: string; // ROLE_VIEWER | ROLE_EDITOR | ROLE_OWNER
}
interface MailboxUser {
  permitId: string;
  userId: string;
  userName: string;
  role: string;
}
interface CompanyUser {
  id: string;
  name: string;
}

const roleLabels: Record<string, string> = {
  ROLE_VIEWER: "閲覧者",
  ROLE_EDITOR: "編集者 (送信可)",
  ROLE_OWNER: "オーナー",
};
const roleBadge: Record<string, string> = {
  ROLE_VIEWER: "bg-gray-100 text-gray-800",
  ROLE_EDITOR: "bg-blue-100 text-blue-800",
  ROLE_OWNER: "bg-purple-100 text-purple-800",
};

export default function MailboxManagement() {
  const authUser = useAuthStore((s) => s.user);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新規登録フォーム
  const [newAddress, setNewAddress] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // 展開中のメールボックスのメンバー
  const [expanded, setExpanded] = useState<string | null>(null);
  const [members, setMembers] = useState<MailboxUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("ROLE_EDITOR");

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

  const fetchMailboxes = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    try {
      const data = await post("/mailbox.v1.MailboxService/ListMailboxes", {});
      setMailboxes(
        (data.mailboxes || []).map((m: any) => ({
          id: m.id,
          address: m.address,
          displayName: m.displayName ?? m.display_name ?? "",
          active: m.active ?? false,
          role: m.role ?? "ROLE_VIEWER",
        })),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "メールボックスの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [authUser, post]);

  const fetchCompanyUsers = useCallback(async () => {
    if (!authUser) return;
    try {
      const data = await post("/user.v1.UserService/ListCompanyUsers", {});
      setCompanyUsers((data.users || []).map((u: any) => ({ id: u.id, name: u.name })));
    } catch {
      /* メンバー選択が出ないだけなので握りつぶす */
    }
  }, [authUser, post]);

  useEffect(() => {
    fetchMailboxes();
    fetchCompanyUsers();
  }, [fetchMailboxes, fetchCompanyUsers]);

  const handleCreate = async () => {
    if (!newAddress || !newPassword) return;
    setCreating(true);
    try {
      await post("/mailbox.v1.MailboxService/CreateMailbox", {
        address: newAddress,
        password: newPassword,
        display_name: newDisplayName,
      });
      setNewAddress("");
      setNewDisplayName("");
      setNewPassword("");
      await fetchMailboxes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このメールボックスを削除しますか?")) return;
    try {
      await post("/mailbox.v1.MailboxService/DeleteMailbox", { id });
      if (expanded === id) setExpanded(null);
      await fetchMailboxes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const loadMembers = async (mailboxId: string) => {
    if (expanded === mailboxId) {
      setExpanded(null);
      return;
    }
    setExpanded(mailboxId);
    setMembers([]);
    try {
      const data = await post("/mailbox.v1.MailboxService/ListMailboxUsers", { mailbox_id: mailboxId });
      setMembers(
        (data.users || []).map((u: any) => ({
          permitId: u.permitId ?? u.permit_id,
          userId: u.userId ?? u.user_id,
          userName: u.userName ?? u.user_name ?? "",
          role: u.role,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "メンバーの取得に失敗しました");
    }
  };

  const handleAddMember = async (mailboxId: string) => {
    if (!selectedUserId) return;
    try {
      await post("/mailbox.v1.MailboxService/AddMailboxUser", {
        mailbox_id: mailboxId,
        user_id: selectedUserId,
        role: selectedRole,
      });
      setSelectedUserId("");
      await loadMembersRefresh(mailboxId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "メンバー追加に失敗しました");
    }
  };

  const handleRemoveMember = async (mailboxId: string, userId: string) => {
    try {
      await post("/mailbox.v1.MailboxService/RemoveMailboxUser", { mailbox_id: mailboxId, user_id: userId });
      await loadMembersRefresh(mailboxId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "メンバー削除に失敗しました");
    }
  };

  // 展開状態を保ったままメンバー再取得。
  const loadMembersRefresh = async (mailboxId: string) => {
    const data = await post("/mailbox.v1.MailboxService/ListMailboxUsers", { mailbox_id: mailboxId });
    setMembers(
      (data.users || []).map((u: any) => ({
        permitId: u.permitId ?? u.permit_id,
        userId: u.userId ?? u.user_id,
        userName: u.userName ?? u.user_name ?? "",
        role: u.role,
      })),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FiMail className="w-5 h-5" />
          メールボックス
        </CardTitle>
        <CardDescription>
          Phox が送受信に使う実メールアドレスを登録し、使える人を選びます。
          編集者以上のメンバーがそのアドレスから送信できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-sm text-red-700">{error}</div>
        )}

        {/* 新規登録 */}
        <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border bg-gray-50">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-gray-500">アドレス</label>
            <Input placeholder="sales@0utl1er.tech" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-gray-500">表示名</label>
            <Input placeholder="営業窓口" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-gray-500">パスワード (mailu)</label>
            <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <Button onClick={handleCreate} disabled={creating || !newAddress || !newPassword}>
            <FiPlus className="w-4 h-4 mr-1" />
            {creating ? "登録中..." : "登録"}
          </Button>
        </div>

        {/* 一覧 */}
        {loading ? (
          <p className="text-sm text-gray-400">読み込み中...</p>
        ) : mailboxes.length === 0 ? (
          <p className="text-sm text-gray-400">まだメールボックスがありません。</p>
        ) : (
          <div className="space-y-2">
            {mailboxes.map((m) => (
              <div key={m.id} className="border rounded-lg">
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => loadMembers(m.id)}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="メンバーを表示"
                  >
                    {expanded === m.id ? <FiChevronDown /> : <FiChevronRight />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {m.displayName ? `${m.displayName} <${m.address}>` : m.address}
                    </div>
                  </div>
                  <Badge className={roleBadge[m.role] ?? ""}>{roleLabels[m.role] ?? m.role}</Badge>
                  {!m.active && <Badge className="bg-gray-100 text-gray-500">無効</Badge>}
                  {m.role === "ROLE_OWNER" && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)} aria-label="削除">
                      <FiTrash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>

                {expanded === m.id && (
                  <div className="border-t px-3 py-3 bg-gray-50/50 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <FiUsers className="w-3.5 h-3.5" /> メンバー
                    </div>
                    {members.map((u) => (
                      <div key={u.userId} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate">{u.userName || u.userId}</span>
                        <Badge className={roleBadge[u.role] ?? ""}>{roleLabels[u.role] ?? u.role}</Badge>
                        {m.role === "ROLE_OWNER" && u.role !== "ROLE_OWNER" && (
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.id, u.userId)} aria-label="メンバー削除">
                            <FiTrash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {m.role === "ROLE_OWNER" && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="ユーザーを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {companyUsers
                              .filter((cu) => !members.some((mm) => mm.userId === cu.id))
                              .map((cu) => (
                                <SelectItem key={cu.id} value={cu.id}>
                                  {cu.name || cu.id}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                          <SelectTrigger className="w-[150px] h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ROLE_VIEWER">閲覧者</SelectItem>
                            <SelectItem value="ROLE_EDITOR">編集者 (送信可)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => handleAddMember(m.id)} disabled={!selectedUserId}>
                          <FiPlus className="w-4 h-4 mr-1" />
                          追加
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
