"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  FiPlus,
  FiUser,
  FiPhone,
  FiSettings
} from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";

interface Customer {
  id: string;
  bookId: string;
  phone: string;
  category: string;
  name: string;
  corporation: string;
  address: string;
  memo: string;
}

interface CustomerListPageProps {
  params: Promise<{ book_id: string }>;
}

export default function CustomerListPage({ params }: CustomerListPageProps) {
  const { book_id: bookId } = use(params);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!user || !bookId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const token = await user.getIdToken();
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
        
        const response = await fetch(`${apiUrl}/customer.v1.CustomerService/ListCustomer`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            book_id: bookId,
            limit: 100,
            offset: 0
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`顧客一覧の取得に失敗しました: ${errorText}`);
        }

        const data = await response.json();
        const customerList = (data.customers || []).map((c: any) => ({
          id: c.id || '',
          bookId: c.book_id || c.bookId || '',
          phone: c.phone || '',
          category: c.category || '',
          name: c.name || '',
          corporation: c.corporation || '',
          address: c.address || '',
          memo: c.memo || '',
        }));
        setCustomers(customerList);
      } catch (e: any) {
        console.error('Failed to fetch customers:', e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [user, bookId]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">顧客一覧</h1>
            </div>
            <div className="flex gap-2">
              <Link href={`/book/${bookId}/settings`}>
                <Button variant="outline">
                  <FiSettings className="w-4 h-4 mr-2" />
                  ブック設定
                </Button>
              </Link>
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
                <FiPlus className="w-4 h-4 mr-2" />
                CSVインポート
              </Button>
            </div>
          </div>
        </div>

        {/* 顧客テーブル */}
        <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="justify-between">
            <CardTitle className="text-xl font-semibold text-gray-900">顧客一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <p className="text-gray-500">読み込み中...</p>
              </div>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : !user ? (
              <p className="text-gray-500">ログインしてください。</p>
            ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
                    <TableHead className="text-white font-medium">顧客名</TableHead>
                    <TableHead className="text-white font-medium">法人名</TableHead>
                    <TableHead className="text-white font-medium">カテゴリ</TableHead>
                    <TableHead className="text-white font-medium">電話番号</TableHead>
                    <TableHead className="text-white font-medium">メモ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length > 0 ? (
                    customers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <TableCell>
                          <Link href={`/book/${bookId}/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <div className="flex items-center gap-2">
                              <FiUser className="w-4 h-4 text-gray-500" />
                              <div>
                                <div className="font-medium text-gray-900">{customer.name || '(名前なし)'}</div>
                                <div className="text-sm text-gray-500">{customer.address}</div>
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/book/${bookId}/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <div className="font-medium text-gray-900">{customer.corporation || '-'}</div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/book/${bookId}/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <Badge variant="outline" className="border-gray-300">
                              {customer.category || '-'}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/book/${bookId}/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <div className="flex items-center gap-1 text-sm">
                              <FiPhone className="w-3 h-3 text-gray-500" />
                              {customer.phone || '-'}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/book/${bookId}/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <div className="text-sm text-gray-900 truncate max-w-xs">{customer.memo || '-'}</div>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        顧客データがありません
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
