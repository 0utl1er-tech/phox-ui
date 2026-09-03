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
import {
  FiMail,
  FiPlus,
  FiTrash2,
  FiUsers,
  FiChevronDown,
  FiChevronRight,
  FiActivity,
  FiSend,
  FiAlertTriangle,
} from "react-icons/fi";
import { MailboxHealthCard } from "@/components/crm/campaign/MailboxHealthCard";
import {
  type MailboxHealthStats,
  normalizeMailboxHealthStats,
  formatRelativeTime,
} from "@/lib/campaign";

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

// Phase 27g: 実績ベースの簡易健全性バッジ (バウンス率 <2% 健全 / 2-5% 注意 / >5% 警告)。
// 判定そのものは backend (ListMailboxesHealth の grade) に従う。
const healthGradeBadge: Record<string, { label: string; className: string }> = {
  good: { label: "健全", className: "bg-green-100 text-green-800" },
  warn: { label: "注意", className: "bg-amber-100 text-amber-800" },
  bad: { label: "警告", className: "bg-red-100 text-red-800" },
};

const IMAP_STALE_MS = 24 * 60 * 60 * 1000;

const pct = (v: number) => `${v.toFixed(1)}%`;

/** Phase 27g: mailbox 1 件分の実績サマリ行。stats 未取得 (undefined) なら出さない。 */
function MailboxHealthSummary({ stats }: { stats: MailboxHealthStats }) {
  const grade = healthGradeBadge[stats.grade];
  const lastSent = formatRelativeTime(stats.lastSentAt);
  const imapAgo = formatRelativeTime(stats.imapSyncedAt);
  const imapStale =
    !stats.imapSyncedAt ||
    Date.now() - new Date(stats.imapSyncedAt).getTime() > IMAP_STALE_MS;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
      {grade && (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${grade.className}`}
        >
          {grade.label}
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <FiSend className="w-3 h-3" />
        本日 {stats.sentToday.toLocaleString()}通送信
        {lastSent && ` ・ 最終送信 ${lastSent}`}
      </span>
      <span>
        30日: 送信{stats.sent30d.toLocaleString()}
        {stats.sent30d > 0 && (
          <>
            {" ・ バウンス"}
            {pct(stats.bounceRate)}
            {" ・ 配停"}
            {pct(stats.unsubscribeRate)}
            {" ・ 返信"}
            {pct(stats.replyRate)}
          </>
        )}
      </span>
      {stats.runningCampaigns > 0 && (
        <span>実行中キャンペーン {stats.runningCampaigns}件で使用中</span>
      )}
      {imapStale ? (
        <span className="inline-flex items-center gap-1 text-amber-600">
          <FiAlertTriangle className="w-3 h-3" />
          {imapAgo
            ? `受信取り込みが止まっている可能性 (最終同期 ${imapAgo})`
            : "受信取り込みが止まっている可能性 (同期記録なし)"}
        </span>
      ) : (
        imapAgo && <span>IMAP同期 {imapAgo}</span>
      )}
    </div>
  );
}

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

  // Phase 27f: 健全性チェックを開いているメールボックス (null = 閉)。
  // DNS を引くので開いただけでは走らせず、カード内のボタン操作でのみ実行する。
  const [healthOpen, setHealthOpen] = useState<string | null>(null);

  // Phase 27g: mailbox 毎の送信実績サマリ (ListMailboxesHealth)。
  // DB 集計のみで軽いので一覧と一緒に毎回取得する (DNS 点検は含まれない)。
  const [healthStats, setHealthStats] = useState<Record<string, MailboxHealthStats>>({});
  const [healthStatsError, setHealthStatsError] = useState(false);

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

  const fetchHealthStats = useCallback(async () => {
    if (!authUser) return;
    try {
      const data = await post("/campaign.v1.CampaignService/ListMailboxesHealth", {});
      const map: Record<string, MailboxHealthStats> = {};
      for (const raw of data.stats || []) {
        const s = normalizeMailboxHealthStats(raw);
        if (s.mailboxId) map[s.mailboxId] = s;
      }
      setHealthStats(map);
      setHealthStatsError(false);
    } catch {
      // サマリが出ないだけなので一覧自体は生かす (行内に注記を出す)。
      setHealthStatsError(true);
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
    fetchHealthStats();
    fetchCompanyUsers();
  }, [fetchMailboxes, fetchHealthStats, fetchCompanyUsers]);

  const handleCreate = async () => {
    if (!newAddress) return;
    setCreating(true);
    try {
      await post("/mailbox.v1.MailboxService/CreateMailbox", {
        address: newAddress,
        // 空なら Phox が mailu にアカウントを作りパスワードを自動生成する。
        ...(newPassword ? { password: newPassword } : {}),
        display_name: newDisplayName,
      });
      setNewAddress("");
      setNewDisplayName("");
      setNewPassword("");
      await fetchMailboxes();
      fetchHealthStats();
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
      if (healthOpen === id) setHealthOpen(null);
      await fetchMailboxes();
      fetchHealthStats();
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
            <label className="text-xs text-gray-500">パスワード</label>
            <Input type="password" placeholder="空ならPhoxが自動生成" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <Button onClick={handleCreate} disabled={creating || !newAddress}>
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
            {/* Phase 27g: 全 mailbox の本日合計送信数 */}
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-sm text-blue-900">
              <FiSend className="w-4 h-4" />
              <span>
                本日の合計送信数:{" "}
                <span className="font-semibold tabular-nums">
                  {mailboxes
                    .reduce((sum, m) => sum + (healthStats[m.id]?.sentToday ?? 0), 0)
                    .toLocaleString()}
                </span>
                通
              </span>
              {healthStatsError && (
                <span className="text-xs text-amber-700">
                  (実績サマリの取得に失敗しました)
                </span>
              )}
            </div>
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
                    {healthStats[m.id] && <MailboxHealthSummary stats={healthStats[m.id]} />}
                  </div>
                  <Badge className={roleBadge[m.role] ?? ""}>{roleLabels[m.role] ?? m.role}</Badge>
                  {!m.active && <Badge className="bg-gray-100 text-gray-500">無効</Badge>}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHealthOpen((cur) => (cur === m.id ? null : m.id))}
                    aria-label="詳細チェック"
                    title="送信ドメインの DNS 設定 (SPF/DKIM/DMARC/MX) を詳細チェック"
                  >
                    <FiActivity className="w-4 h-4 mr-1" />
                    詳細チェック
                  </Button>
                  {m.role === "ROLE_OWNER" && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)} aria-label="削除">
                      <FiTrash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>

                {healthOpen === m.id && (
                  <div className="border-t px-3 py-3 bg-gray-50/50">
                    <MailboxHealthCard mailboxId={m.id} />
                  </div>
                )}

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
