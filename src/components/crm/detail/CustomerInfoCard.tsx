import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FiUser, 
  FiMapPin, 
  FiMail, 
  FiPhone, 
  FiEdit3, 
  FiSave,
  FiBriefcase,
  FiHome
} from "react-icons/fi";
import { FaFax } from "react-icons/fa";

export default function CustomerInfoCard() {
  return (
    <Card className="shadow-soft border-0 bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm h-full hover:shadow-lg transition-all duration-300">
      <CardHeader className="flex items-center gap-2">
        <FiUser className="w-5 h-5 text-blue-600" />
        <CardTitle className="text-lg text-gray-900">顧客情報</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* カテゴリ・業種 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiHome className="w-4 h-4 text-green-600" />
              大カテゴリ
            </label>
            <Input className="group-hover:border-blue-300 transition-colors" />
          </div>
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiBriefcase className="w-4 h-4 text-blue-600" />
              業種
            </label>
            <Input className="group-hover:border-green-300 transition-colors" />
          </div>
        </div>

        {/* 顧客名 */}
        <div className="space-y-2 group">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FiUser className="w-4 h-4 text-purple-600" />
            法人名
          </label>
          <Input className="w-full group-hover:border-purple-300 transition-colors" />
        </div>
        <div className="space-y-2 group">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FiUser className="w-4 h-4 text-indigo-600" />
            顧客名
          </label>
          <Input className="w-full group-hover:border-indigo-300 transition-colors" />
        </div>

        {/* 住所 */}
        <div className="flex gap-2">
          <div className="space-y-2 flex-1 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiMapPin className="w-4 h-4 text-red-600" />
              都道府県
            </label>
            <Input className="group-hover:border-red-300 transition-colors" />
          </div>
          <div className="space-y-2 flex-3 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiMapPin className="w-4 h-4 text-orange-600" />
              住所
            </label>
            <Input className="group-hover:border-orange-300 transition-colors" />
          </div>
        </div>

        {/* 代表・担当 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiUser className="w-4 h-4 text-teal-600" />
              代表
            </label>
            <div className="flex gap-2">
              <Input className="flex-1 group-hover:border-teal-300 transition-colors" />
              <Input className="w-20 group-hover:border-teal-300 transition-colors" />
            </div>
          </div>

          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiUser className="w-4 h-4 text-cyan-600" />
              担当
            </label>
            <div className="flex gap-2">
              <Input className="flex-1 group-hover:border-cyan-300 transition-colors" />
              <Input className="w-20 group-hover:border-cyan-300 transition-colors" />
            </div>
          </div>
        </div>

        {/* メール・FAX */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiMail className="w-4 h-4 text-blue-600" />
              Mail
            </label>
            <Input placeholder="" className="group-hover:border-blue-300 transition-colors" />
          </div>
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FaFax className="w-4 h-4 text-green-600" />
              FAX
            </label>
            <div className="flex gap-2">
              <Input className="flex-1 group-hover:border-green-300 transition-colors" />
            </div>
          </div>
        </div>

        {/* メモセクション */}
        <div className="space-y-2 group">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FiEdit3 className="w-4 h-4 text-purple-600" />
            メモ
          </label>
          <div className="relative">
            <Textarea
              className="min-h-[200px] resize-none border-0 border-1 focus-visible:ring-0 group-hover:border-purple-300 transition-colors bg-gradient-to-br from-gray-50 to-white"
            />
            <div className="absolute top-2 right-2">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-60 hover:opacity-100">
                <FiSave className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 