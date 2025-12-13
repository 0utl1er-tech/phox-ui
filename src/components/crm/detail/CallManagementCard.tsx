"use client"

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { FiPhone } from "react-icons/fi";

interface Call {
  id: string;
  customerId: string;
  phone: string;
  userId: string;
  userName: string;
  statusId: string;
  statusName: string;
  statusPriority: number;
  statusEffective: boolean;
  statusNg: boolean;
  createdAt: string;
}

interface Status {
  id: string;
  bookId: string;
  priority: number;
  name: string;
  effective: boolean;
  ng: boolean;
}

interface CallManagementCardProps {
  customerId: string;
  bookId: string;
  customerPhone?: string;
}

export default function CallManagementCard({ customerId, bookId, customerPhone }: CallManagementCardProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const user = useAuthStore((state) => state.user);

  const fetchCalls = useCallback(async () => {
    if (!user || !customerId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/call.v1.CallService/ListCallsByCustomerID`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customer_id: customerId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`コール履歴の取得に失敗しました: ${errorText}`);
      }

      const data = await response.json();
      const callList = (data.calls || []).map((c: any) => ({
        id: c.id,
        customerId: c.customer_id || c.customerId,
        phone: c.phone,
        userId: c.user_id || c.userId,
        userName: c.user_name || c.userName,
        statusId: c.status_id || c.statusId,
        statusName: c.status_name || c.statusName,
        statusPriority: c.status_priority || c.statusPriority,
        statusEffective: c.status_effective || c.statusEffective,
        statusNg: c.status_ng || c.statusNg,
        createdAt: c.created_at || c.createdAt,
      }));
      setCalls(callList);
    } catch (e: any) {
      console.error('Fetch error:', e);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, customerId]);

  const fetchStatuses = useCallback(async () => {
    if (!user || !bookId) return;

    try {
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
      if (statusList.length > 0 && !selectedStatusId) {
        setSelectedStatusId(statusList[0].id);
      }
    } catch (e: any) {
      console.error('Fetch statuses error:', e);
    }
  }, [user, bookId, selectedStatusId]);

  useEffect(() => {
    fetchCalls();
    fetchStatuses();
  }, [fetchCalls, fetchStatuses]);

  const handleCreateCall = async () => {
    if (!user || !selectedStatusId || !customerPhone) return;

    try {
      setIsCreating(true);
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/call.v1.CallService/CreateCall`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customerId,
          phone: customerPhone,
          status_id: selectedStatusId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`コールの記録に失敗しました: ${errorText}`);
      }

      fetchCalls();
    } catch (e: any) {
      console.error('Create call error:', e);
      setError(e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return { date: '-', time: '-' };
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('ja-JP'),
      time: date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const getStatusBadgeStyle = (status: { effective: boolean; ng: boolean }) => {
    if (status.ng) {
      return "bg-red-100 text-red-800";
    }
    if (status.effective) {
      return "bg-green-100 text-green-800";
    }
    return "bg-blue-100 text-blue-800";
  };

  return (
    <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r text-black rounded-t-lg">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">コール履歴</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* コール記録フォーム */}
        <div className="flex gap-4 items-end p-4 bg-blue-50 rounded-lg">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-1 block">電話番号</label>
            <div className="flex items-center gap-2 p-2 bg-white rounded border">
              <FiPhone className="w-4 h-4 text-gray-500" />
              <span>{customerPhone || '-'}</span>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-1 block">コール結果</label>
            <Select value={selectedStatusId} onValueChange={setSelectedStatusId}>
              <SelectTrigger>
                <SelectValue placeholder="ステータスを選択" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleCreateCall}
            disabled={isCreating || !selectedStatusId || !customerPhone}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          >
            <FiPhone className="w-4 h-4 mr-2" />
            コール記録
          </Button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {/* コール履歴一覧 */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
                <TableHead className="text-white font-medium">日付</TableHead>
                <TableHead className="text-white font-medium">時刻</TableHead>
                <TableHead className="text-white font-medium">電話番号</TableHead>
                <TableHead className="text-white font-medium">コール者</TableHead>
                <TableHead className="text-white font-medium">コール結果</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : calls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    コール履歴がありません
                  </TableCell>
                </TableRow>
              ) : (
                calls.map((call, index) => {
                  const { date, time } = formatDateTime(call.createdAt);
                  return (
                    <TableRow 
                      key={call.id} 
                      className={index === 0 ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"}
                    >
                      <TableCell className="font-medium">{date}</TableCell>
                      <TableCell>{time}</TableCell>
                      <TableCell>{call.phone || '-'}</TableCell>
                      <TableCell>{call.userName || '-'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={getStatusBadgeStyle({ 
                            effective: call.statusEffective, 
                            ng: call.statusNg 
                          })}
                        >
                          {call.statusName}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* コールアクションボタン */}
        <div className="flex gap-4">
          <Button className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
            再コール予約
          </Button>
          <Button variant="outline" className="flex-1 border-gray-300 hover:bg-gray-50">
            再コールキャンセル
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 
