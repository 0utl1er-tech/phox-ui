"use client"

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { FiPlus, FiTrash2, FiUsers } from "react-icons/fi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BookUser {
  permitId: string;
  userId: string;
  userName: string;
  role: string;
}

interface CompanyUser {
  id: string;
  name: string;
}

interface UserAccessManagementProps {
  bookId: string;
}

const roleLabels: Record<string, string> = {
  "ROLE_VIEWER": "閲覧者",
  "ROLE_EDITOR": "編集者",
  "ROLE_OWNER": "オーナー",
};

const roleBadgeColors: Record<string, string> = {
  "ROLE_VIEWER": "bg-gray-100 text-gray-800",
  "ROLE_EDITOR": "bg-blue-100 text-blue-800",
  "ROLE_OWNER": "bg-purple-100 text-purple-800",
};

export default function UserAccessManagement({ bookId }: UserAccessManagementProps) {
  const [bookUsers, setBookUsers] = useState<BookUser[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("ROLE_VIEWER");
  const [isAdding, setIsAdding] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const user = useAuthStore((state) => state.user);

  const fetchBookUsers = useCallback(async () => {
    if (!user || !bookId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/permit.v1.PermitService/ListBookUsers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ book_id: bookId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ユーザー一覧の取得に失敗しました: ${errorText}`);
      }

      const data = await response.json();
      const userList = (data.users || []).map((u: any) => ({
        permitId: u.permit_id || u.permitId,
        userId: u.user_id || u.userId,
        userName: u.user_name || u.userName,
        role: u.role,
      }));
      setBookUsers(userList);

      const currentUserPermit = userList.find((u: BookUser) => u.userId === user.uid);
      setIsOwner(currentUserPermit?.role === "ROLE_OWNER");
    } catch (e: unknown) {
      console.error('Fetch error:', e);
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user, bookId]);

  const fetchCompanyUsers = useCallback(async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/user.v1.UserService/ListCompanyUsers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const userList = (data.users || []).map((u: any) => ({
        id: u.id,
        name: u.name,
      }));
      setCompanyUsers(userList);
    } catch (e) {
      console.error('Fetch company users error:', e);
    }
  }, [user]);

  useEffect(() => {
    fetchBookUsers();
    fetchCompanyUsers();
  }, [fetchBookUsers, fetchCompanyUsers]);

  const handleAddUser = async () => {
    if (!user || !selectedUserId) return;

    try {
      setIsAdding(true);
      setError(null);
      setSuccessMessage(null);
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/permit.v1.PermitService/AddBookUser`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book_id: bookId,
          user_id: selectedUserId,
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (errorText.includes("既にアクセス権を持っています") || errorText.includes("AlreadyExists")) {
          throw new Error("このユーザーは既にアクセス権を持っています");
        }
        if (errorText.includes("オーナー権限が必要") || errorText.includes("PermissionDenied")) {
          throw new Error("ユーザーを追加するにはオーナー権限が必要です");
        }
        throw new Error(`ユーザーの追加に失敗しました: ${errorText}`);
      }

      setSuccessMessage("ユーザーを追加しました");
      setSelectedUserId("");
      setSelectedRole("ROLE_VIEWER");
      fetchBookUsers();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: unknown) {
      console.error('Add user error:', e);
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUser = async (permitId: string, userName: string) => {
    if (!user) return;
    if (!confirm(`${userName} のアクセス権を削除しますか？`)) return;

    try {
      setError(null);
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/permit.v1.PermitService/DeletePermit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: permitId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`アクセス権の削除に失敗しました: ${errorText}`);
      }

      setSuccessMessage("アクセス権を削除しました");
      fetchBookUsers();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: unknown) {
      console.error('Delete error:', e);
      setError(e instanceof Error ? e.message : 'An error occurred');
    }
  };

  const availableUsers = companyUsers.filter(
    (cu) => !bookUsers.some((bu) => bu.userId === cu.id)
  );

  return (
    <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FiUsers className="w-5 h-5" />
          アクセス権限管理
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOwner && (
          <div className="flex gap-4 items-end p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1 block">ユーザーを追加</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="ユーザーを選択" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.length === 0 ? (
                    <SelectItem value="none" disabled>追加可能なユーザーがいません</SelectItem>
                  ) : (
                    availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <label className="text-sm font-medium text-gray-700 mb-1 block">権限</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROLE_VIEWER">閲覧者</SelectItem>
                  <SelectItem value="ROLE_EDITOR">編集者</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAddUser}
              disabled={isAdding || !selectedUserId || selectedUserId === "none"}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <FiPlus className="w-4 h-4 mr-1" />
              追加
            </Button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-green-50 text-green-600 rounded-lg">
            {successMessage}
          </div>
        )}

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
                <TableHead className="text-white font-medium">ユーザー名</TableHead>
                <TableHead className="text-white font-medium w-32 text-center">権限</TableHead>
                {isOwner && (
                  <TableHead className="text-white font-medium w-24 text-center">操作</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isOwner ? 3 : 2} className="text-center py-8 text-gray-500">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : bookUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isOwner ? 3 : 2} className="text-center py-8 text-gray-500">
                    アクセス権を持つユーザーがいません
                  </TableCell>
                </TableRow>
              ) : (
                bookUsers.map((bookUser) => (
                  <TableRow key={bookUser.permitId} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {bookUser.userName}
                        {bookUser.userId === user?.uid && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            あなた
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className={roleBadgeColors[bookUser.role] || "bg-gray-100 text-gray-800"}>
                        {roleLabels[bookUser.role] || bookUser.role}
                      </Badge>
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-center">
                        {bookUser.role !== "ROLE_OWNER" && bookUser.userId !== user?.uid && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteUser(bookUser.permitId, bookUser.userName)}
                          >
                            <FiTrash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!isOwner && (
          <p className="text-sm text-gray-500">
            ユーザーを追加するにはオーナー権限が必要です
          </p>
        )}
      </CardContent>
    </Card>
  );
}
