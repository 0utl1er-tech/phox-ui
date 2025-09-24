import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaRegAddressBook } from "react-icons/fa";


export default function ContactInfoCard() {
  return (
    <Card className="shadow-soft border-0 bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
      <CardHeader className="flex items-center gap-2">
        <FaRegAddressBook className="w-5 h-5 text-blue-600" />
        <CardTitle className="text-lg text-gray-900">連絡先情報</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">

        {/* 電話番号 */}
        <div className="space-y-2">
          <label className=" font-medium text-gray-700">代表番号</label>
          <div className="flex gap-2">
            <Input className="flex-1" />
          </div>
        </div>

        <div className="flex justify-between items-center pt-3">
          <label className="font-medium text-gray-700">連絡先を追加</label>
          <Button variant="outline" className="border-gray-300 hover:bg-blue-450 bg-blue-500 text-white">
            <span>新規作成</span>
          </Button>
        </div>
        <div className="border rounded-lg overflow-hidden mt-3">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
                <TableHead className="text-white font-medium">連絡先</TableHead>
                <TableHead className="text-white font-medium">メール</TableHead>
                <TableHead className="text-white font-medium">電話番号</TableHead>
                <TableHead className="text-white font-medium">架電回数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>佐藤忍</TableCell>
                <TableCell>sato@sns-master.jp</TableCell>
                <TableCell>09098366284</TableCell>
                <TableCell>1</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
} 
