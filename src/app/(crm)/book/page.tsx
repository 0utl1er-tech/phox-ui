import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  FiPlus,
  FiUser,
  FiPhone,
  FiMail
} from "react-icons/fi";

// ダミーデータ
const customers = [
  {
    id: 1,
    name: "Bar Andaluci",
    company: "株式会社アンダルシア",
    category: "飲食",
    industry: "Bar",
    phone: "09098366284",
    email: "info@andaluci.jp",
    address: "栃木県宇都宮市中央5丁目1-2",
    status: "active",
    lastContact: "2025/06/06",
    salesPerson: "佐藤忍",
    memo: "有料オプションサービスに抵抗あり"
  },
  {
    id: 2,
    name: "Cafe Milano",
    company: "ミラノカフェ株式会社",
    category: "飲食",
    industry: "Cafe",
    phone: "03-1234-5678",
    email: "contact@milano-cafe.com",
    address: "東京都渋谷区神南1-2-3",
    status: "prospect",
    lastContact: "2025/06/05",
    salesPerson: "田中花子",
    memo: "新規オープン予定"
  },
  {
    id: 3,
    name: "Tech Solutions Inc.",
    company: "テックソリューションズ株式会社",
    category: "IT",
    industry: "ソフトウェア開発",
    phone: "06-9876-5432",
    email: "info@techsolutions.co.jp",
    address: "大阪府大阪市北区梅田1-1-1",
    status: "inactive",
    lastContact: "2025/05/20",
    salesPerson: "山田太郎",
    memo: "大手企業との取引あり"
  },
  {
    id: 4,
    name: "Green Garden",
    company: "グリーンガーデン有限会社",
    category: "サービス",
    industry: "ガーデニング",
    phone: "052-123-4567",
    email: "info@greengarden.jp",
    address: "愛知県名古屋市中区栄1-1-1",
    status: "active",
    lastContact: "2025/06/04",
    salesPerson: "鈴木一郎",
    memo: "定期メンテナンス契約中"
  },
  {
    id: 5,
    name: "Fashion Boutique",
    company: "ファッションブティック",
    category: "小売",
    industry: "アパレル",
    phone: "045-123-4567",
    email: "contact@fashion-boutique.jp",
    address: "神奈川県横浜市西区みなとみらい1-1-1",
    status: "prospect",
    lastContact: "2025/06/03",
    salesPerson: "高橋美咲",
    memo: "若年層向けブランド展開予定"
  }
];

export default function CustomerListPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">顧客一覧</h1>
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
                  {customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <TableCell>
                        <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                          <div className="flex items-center gap-2">
                            <FiUser className="w-4 h-4 text-gray-500" />
                            <div>
                              <div className="font-medium text-gray-900">{customer.name}</div>
                              <div className="text-sm text-gray-500">{customer.address}</div>
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                          <div className="font-medium text-gray-900">{customer.company}</div>
                          <div className="text-sm text-gray-500">{customer.industry}</div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                          <Badge variant="outline" className="border-gray-300">
                            {customer.category}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-sm">
                              <FiPhone className="w-3 h-3 text-gray-500" />
                              {customer.phone}
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <FiMail className="w-3 h-3 text-gray-500" />
                              {customer.email}
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                          <div className="text-sm text-gray-900">{customer.lastContact}</div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/customer/${customer.id}`} className="block hover:bg-gray-50 p-2 -m-2 rounded">
                          <div className="text-sm font-medium text-gray-900">{customer.salesPerson}</div>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
