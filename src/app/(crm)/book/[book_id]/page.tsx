"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// Card は削除 — テーブルを直接表示 (Phase 21b)
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CreateCustomerDialog } from "@/components/crm/create-customer-dialog";
import Link from "next/link";
import {
  FiUser,
  FiPhone,
  FiTrash2,
  FiUserPlus,
} from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import BookNavigationBar from "@/components/crm/BookNavigationBar";

interface Customer {
  id: string;
  bookId: string;
  phone: string;
  category: string;
  name: string;
  corporation: string;
  address: string;
  memo: string;
  mail: string;
}

interface CustomerListPageProps {
  params: Promise<{ book_id: string }>;
}

export default function CustomerListPage({ params }: CustomerListPageProps) {
  const { book_id: bookId } = use(params);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const router = useRouter();

  // Vim-style keyboard navigation: j/k/Enter/Esc
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // input/textarea にフォーカスがある時は無視
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    switch (e.key) {
      case "j":
        e.preventDefault();
        setSelectedIdx((prev) => Math.min(prev + 1, customers.length - 1));
        break;
      case "k":
        e.preventDefault();
        setSelectedIdx((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        if (selectedIdx >= 0 && selectedIdx < customers.length) {
          e.preventDefault();
          router.push(`/book/${bookId}/customer/${customers[selectedIdx].id}`);
        }
        break;
      case "Escape":
        setSelectedIdx(-1);
        break;
    }
  }, [customers, selectedIdx, bookId, router]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ページ変更時に選択リセット
  useEffect(() => { setSelectedIdx(-1); }, [page]);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!user || !bookId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const token = user.accessToken;
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';

        const response = await fetch(`${apiUrl}/customer.v1.CustomerService/ListCustomer`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            book_id: bookId,
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
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
          mail: c.mail || '',
        }));
        setCustomers(customerList);
        setTotalCount(data.total_count ?? data.totalCount ?? customerList.length);
      } catch (e: any) {
        console.error('Failed to fetch customers:', e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [user, bookId, page]);

  const handleCustomerCreated = (customer: Customer) => {
    setCustomers((prev) => [customer, ...prev]);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete || !user) return;
    setIsDeletingCustomer(true);
    setDeleteError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      const response = await fetch(`${apiUrl}/customer.v1.CustomerService/DeleteCustomer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customer_id: customerToDelete.id }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id));
      setCustomerToDelete(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown error";
      setDeleteError(`削除に失敗しました: ${message}`);
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <BookNavigationBar bookId={bookId} />
      <div className="px-4 py-4">
        {/* ヘッダー — ブック設定は BookNavigationBar に統合済み */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">顧客一覧</h1>
          <Button
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <FiUserPlus className="w-4 h-4 mr-2" />
            顧客を追加
          </Button>
        </div>

        {/* 顧客テーブル (カードなし、フル幅) */}
        <div>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <p className="text-gray-500">読み込み中...</p>
              </div>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : !user ? (
              <p className="text-gray-500">ログインしてください。</p>
            ) : (
            <div className="border rounded-2xl overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b">
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">顧客名</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">法人名</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">カテゴリ</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">電話番号</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">メモ</TableHead>
                    <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length > 0 ? (
                    customers.map((customer, idx) => (
                      <TableRow
                        key={customer.id}
                        className={`transition-colors cursor-pointer ${
                          idx === selectedIdx
                            ? "bg-blue-50 ring-1 ring-blue-300"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedIdx(idx)}
                        onDoubleClick={() => router.push(`/book/${bookId}/customer/${customer.id}`)}
                      >
                        <TableCell>
                          <Link href={`/book/${bookId}/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <div className="flex items-center gap-2">
                              <FiUser className="w-4 h-4 text-gray-500" />
                              <div>
                                <div className="font-medium text-gray-900">{customer.name || '(名前なし)'}</div>
                                <div className="text-sm text-gray-500 truncate max-w-[250px]" title={customer.address}>{customer.address}</div>
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
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="削除"
                            title="顧客を削除"
                            onClick={() => setCustomerToDelete(customer)}
                          >
                            <FiTrash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        顧客データがありません
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            )}

            {/* ページネーション */}
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-gray-600">
                  {totalCount} 件中 {page * PAGE_SIZE + 1}〜{Math.min((page + 1) * PAGE_SIZE, totalCount)} 件
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← 前へ
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-700">
                    {page + 1} / {Math.ceil(totalCount / PAGE_SIZE)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * PAGE_SIZE >= totalCount}
                    className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    次へ →
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>

      <CreateCustomerDialog
        bookId={bookId}
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={handleCustomerCreated}
      />

      {/* Customer 削除確認ダイアログ (inline) */}
      <Dialog
        open={customerToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCustomerToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogClose onClose={() => setCustomerToDelete(null)} />
          <DialogHeader>
            <DialogTitle>顧客を削除</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{customerToDelete?.name ?? ""}</span> を削除しますか?
              この操作は取り消せません。
            </p>
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomerToDelete(null)}
              disabled={isDeletingCustomer}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeletingCustomer}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeletingCustomer ? "削除中..." : "削除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
