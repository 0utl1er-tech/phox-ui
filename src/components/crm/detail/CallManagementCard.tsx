import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CallManagementCard() {
  return (
    <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r text-black rounded-t-lg">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">コール担当</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* 当日コール集計 */}
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
                  <TableHead className="text-white font-medium">日付</TableHead>
                  <TableHead className="text-white font-medium">時刻</TableHead>
                  <TableHead className="text-white font-medium">連絡先</TableHead>
                  <TableHead className="text-white font-medium">コール者</TableHead>
                  <TableHead className="text-white font-medium">コール結果</TableHead>
                  <TableHead className="text-white font-medium">営業メモ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-yellow-100 hover:bg-yellow-200 transition-colors">
                  <TableCell className="font-medium">2025/06/06</TableCell>
                  <TableCell>16:19</TableCell>
                  <TableCell>代表</TableCell>
                  <TableCell>佐藤忍</TableCell>
                  <TableCell><Badge variant="secondary" className="bg-blue-100 text-blue-800">見込S</Badge></TableCell>
                  <TableCell className="text-sm">連絡あり 6日中に補填についてSMS送る</TableCell>
                </TableRow>
                <TableRow className="transition-colors">
                  <TableCell className="font-medium">2025/06/06</TableCell>
                  <TableCell>16:19</TableCell>
                  <TableCell>代表</TableCell>
                  <TableCell>佐藤忍</TableCell>
                  <TableCell><Badge variant="secondary" className="bg-blue-100 text-blue-800">見込S</Badge></TableCell>
                  <TableCell className="text-sm">連絡あり 6日中に補填についてSMS送る</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* コールアクションボタン */}
        <div className="flex gap-4">
          <Button className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md">
            再コール予約
          </Button>
          <Button variant="outline" className="flex-1 border-gray-300 hover:bg-gray-50">
            再コールキャンセル
          </Button>
        </div>

        {/* 予定コール */}
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm font-medium text-gray-700">日時</span>
                <span className="text-sm">2025/06/10</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm font-medium text-gray-700">時刻</span>
                <span className="text-sm">9:00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">担当</span>
                <span className="text-sm">佐藤忍</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
} 
