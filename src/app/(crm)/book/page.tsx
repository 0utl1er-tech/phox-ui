"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CSVImportDialog } from "@/components/crm/csv-import-dialog";
import Link from "next/link";
import { FiPlus, FiBook, FiUpload } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";

// Define the type for a single book
interface Book {
  id: string;
  name: string;
}

export default function BookListPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  const fetchBooks = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = await user.getIdToken();
      
      console.log('Fetching books with token:', token ? 'Token present' : 'No token');
      
      // Connect-Go endpoint: /package.version.ServiceName/MethodName
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      const url = `${apiUrl}/book.v1.BookService/ListBooks`;
      
      console.log('Fetching from URL:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // Empty request body for ListBooks
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch books: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Received data:', data);
      setBooks(data.books || []);
    } catch (e: any) {
      console.error('Fetch error:', e);
      setError(`エラーが発生しました: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleImportSuccess = useCallback((bookId: string) => {
    // Refresh the book list after successful import
    fetchBooks();
  }, [fetchBooks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">顧客リスト (Books)</h1>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => setIsImportDialogOpen(true)}
              >
                <FiUpload className="w-4 h-4 mr-2" />
                CSVインポート
              </Button>
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
                <FiPlus className="w-4 h-4 mr-2" />
                新しいリストを作成
              </Button>
            </div>
          </div>
        </div>

        <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900">アクセス可能なリスト一覧</CardTitle>
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
                      <TableHead className="text-white font-medium">リスト名</TableHead>
                      <TableHead className="text-white font-medium">アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books && books.length > 0 ? (
                      books.map((book) => (
                        <TableRow key={book.id} className="hover:bg-gray-50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FiBook className="w-4 h-4 text-gray-500" />
                              <div className="font-medium text-gray-900">{book.name}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/book/${book.id}`}>
                              <Button variant="outline" size="sm">顧客を見る</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center">
                          アクセス可能な顧客リストはありません。
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

      <CSVImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
} 
