"use client"

import { use } from "react";
import StatusManagement from "@/components/crm/status-management";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FiArrowLeft, FiSettings } from "react-icons/fi";

interface BookSettingsPageProps {
  params: Promise<{ book_id: string }>;
}

export default function BookSettingsPage({ params }: BookSettingsPageProps) {
  const { book_id } = use(params);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link href={`/book/${book_id}`}>
            <Button variant="ghost" className="mb-4">
              <FiArrowLeft className="w-4 h-4 mr-2" />
              顧客一覧に戻る
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <FiSettings className="w-6 h-6 text-gray-600" />
            <h1 className="text-2xl font-bold text-gray-900">ブック設定</h1>
          </div>
        </div>

        {/* ステータス管理 */}
        <StatusManagement bookId={book_id} />
      </div>
    </div>
  );
}
