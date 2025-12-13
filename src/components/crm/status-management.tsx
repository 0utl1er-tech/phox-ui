"use client"

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/store/authStore";
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiX } from "react-icons/fi";

interface Status {
  id: string;
  bookId: string;
  priority: number;
  name: string;
  effective: boolean;
  ng: boolean;
}

interface StatusManagementProps {
  bookId: string;
}

export default function StatusManagement({ bookId }: StatusManagementProps) {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusEffective, setNewStatusEffective] = useState(false);
  const [newStatusNg, setNewStatusNg] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const user = useAuthStore((state) => state.user);

  const fetchStatuses = useCallback(async () => {
    if (!user || !bookId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/status.v1.StatusService/ListStatuses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ book_id: bookId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ステータスの取得に失敗しました: ${errorText}`);
      }

      const data = await response.json();
      const statusList = (data.statuses || []).map((s: any) => ({
        id: s.id,
        bookId: s.book_id || s.bookId,
        priority: s.priority,
        name: s.name,
        effective: s.effective,
        ng: s.ng,
      }));
      setStatuses(statusList);
    } catch (e: any) {
      console.error('Fetch error:', e);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, bookId]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const handleCreateStatus = async () => {
    if (!user || !newStatusName.trim()) return;

    try {
      setIsCreating(true);
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/status.v1.StatusService/CreateStatus`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book_id: bookId,
          name: newStatusName.trim(),
          effective: newStatusEffective,
          ng: newStatusNg,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ステータスの作成に失敗しました: ${errorText}`);
      }

      setNewStatusName("");
      setNewStatusEffective(false);
      setNewStatusNg(false);
      fetchStatuses();
    } catch (e: any) {
      console.error('Create error:', e);
      setError(e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (status: Status) => {
    if (!user || !editName.trim()) return;

    try {
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/status.v1.StatusService/UpdateStatus`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: status.id,
          name: editName.trim(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ステータスの更新に失敗しました: ${errorText}`);
      }

      setEditingId(null);
      setEditName("");
      fetchStatuses();
    } catch (e: any) {
      console.error('Update error:', e);
      setError(e.message);
    }
  };

  const handleToggleEffective = async (status: Status) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/status.v1.StatusService/UpdateStatus`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: status.id,
          effective: !status.effective,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ステータスの更新に失敗しました: ${errorText}`);
      }

      fetchStatuses();
    } catch (e: any) {
      console.error('Update error:', e);
      setError(e.message);
    }
  };

  const handleToggleNg = async (status: Status) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/status.v1.StatusService/UpdateStatus`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: status.id,
          ng: !status.ng,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ステータスの更新に失敗しました: ${errorText}`);
      }

      fetchStatuses();
    } catch (e: any) {
      console.error('Update error:', e);
      setError(e.message);
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!user) return;
    if (!confirm("このステータスを削除しますか？")) return;

    try {
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/status.v1.StatusService/DeleteStatus`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: statusId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ステータスの削除に失敗しました: ${errorText}`);
      }

      fetchStatuses();
    } catch (e: any) {
      console.error('Delete error:', e);
      setError(e.message);
    }
  };

  return (
    <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">コールステータス管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 新規作成フォーム */}
        <div className="flex gap-4 items-end p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-1 block">ステータス名</label>
            <Input
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              placeholder="新しいステータス名"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">有効</label>
            <Switch
              checked={newStatusEffective}
              onCheckedChange={setNewStatusEffective}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">NG</label>
            <Switch
              checked={newStatusNg}
              onCheckedChange={setNewStatusNg}
            />
          </div>
          <Button 
            onClick={handleCreateStatus}
            disabled={isCreating || !newStatusName.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FiPlus className="w-4 h-4 mr-1" />
            追加
          </Button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {/* ステータス一覧 */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
                <TableHead className="text-white font-medium w-16">優先度</TableHead>
                <TableHead className="text-white font-medium">ステータス名</TableHead>
                <TableHead className="text-white font-medium w-24 text-center">有効</TableHead>
                <TableHead className="text-white font-medium w-24 text-center">NG</TableHead>
                <TableHead className="text-white font-medium w-24 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : statuses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    ステータスがありません
                  </TableCell>
                </TableRow>
              ) : (
                statuses.map((status) => (
                  <TableRow key={status.id} className="hover:bg-gray-50">
                    <TableCell className="text-center">{status.priority}</TableCell>
                    <TableCell>
                      {editingId === status.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdateStatus(status)}
                          >
                            <FiCheck className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setEditName("");
                            }}
                          >
                            <FiX className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {status.name}
                          {status.effective && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              有効
                            </Badge>
                          )}
                          {status.ng && (
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              NG
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={status.effective}
                        onCheckedChange={() => handleToggleEffective(status)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={status.ng}
                        onCheckedChange={() => handleToggleNg(status)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(status.id);
                            setEditName(status.name);
                          }}
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteStatus(status.id)}
                        >
                          <FiTrash2 className="w-4 h-4 text-red-600" />
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
  );
}
