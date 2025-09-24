"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useCustomerStore } from "@/store/customerStore";
import SearchSidebar from "@/components/crm/SearchSidebar";
import {
  FiPlus,
  FiUser,
  FiPhone,
  FiMail
} from "react-icons/fi";



export default function CustomerListPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const { 
    customers, 
    loading, 
    error, 
    fetchCustomers, 
    setCurrentBookId,
    currentBookId 
  } = useCustomerStore();

  const handleSearch = (bookId: string) => {
    setCurrentBookId(bookId);
    fetchCustomers(bookId);
    setCurrentPage(1); // 検索時にページを1にリセット
  };

  // ページネーション用のデータを計算
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return customers.slice(startIndex, endIndex);
  }, [customers, currentPage]);

  const totalPages = Math.ceil(customers.length / itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">読み込み中...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-red-600">エラー: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
      {/* サイドバー */}
      <SearchSidebar 
        onSearch={handleSearch}
        currentBookId={currentBookId}
        loading={loading}
      />

      {/* メインコンテンツ */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {/* ヘッダー */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">顧客一覧</h1>
                {currentBookId && (
                  <p className="text-sm text-gray-600 mt-1">
                    Book ID: {currentBookId}
                  </p>
                )}
              </div>
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
                <FiPlus className="w-4 h-4 mr-2" />
                CSVインポート
              </Button>
            </div>
          </div>

          {/* 顧客テーブル */}
          <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="justify-between">
              <CardTitle className="text-xl font-semibold text-gray-900">厳選リスト</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
                      <TableHead className="text-white font-medium">顧客名</TableHead>
                      <TableHead className="text-white font-medium">会社名</TableHead>
                      <TableHead className="text-white font-medium">カテゴリ</TableHead>
                      <TableHead className="text-white font-medium">連絡先</TableHead>
                      <TableHead className="text-white font-medium">最終連絡</TableHead>
                      <TableHead className="text-white font-medium">担当者</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCustomers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <TableCell className="max-w-xs">
                          <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <div className="flex items-center gap-2">
                              <FiUser className="w-4 h-4 text-gray-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 truncate">{customer.name}</div>
                                <div className="text-sm text-gray-500 truncate">{customer.address}</div>
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">{customer.corporation}</div>
                              <div className="text-sm text-gray-500">業種情報</div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <Badge variant="outline" className="border-gray-300">
                              カテゴリ
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-sm">
                                <FiPhone className="w-3 h-3 text-gray-500" />
                                090-0000-0000
                              </div>
                              <div className="flex items-center gap-1 text-sm">
                                <FiMail className="w-3 h-3 text-gray-500" />
                                info@example.com
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <div className="text-sm text-gray-900">2025/06/06</div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                            <div className="text-sm font-medium text-gray-900">担当者名</div>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {/* ページ番号を表示（最大5ページまで） */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }
                    
                    return (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNumber)}
                          isActive={currentPage === pageNumber}
                          className="cursor-pointer"
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {/* ページ情報 */}
          <div className="mt-4 text-center text-sm text-gray-600">
            {customers.length > 0 ? (
              <>
                {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, customers.length)} / {customers.length} 件
              </>
            ) : (
              "データがありません"
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 
