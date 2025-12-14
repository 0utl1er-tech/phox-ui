"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { 
  FiUser, 
  FiMapPin, 
  FiMail, 
  FiEdit3, 
  FiSave,
  FiBriefcase,
  FiHome,
  FiCheck,
  FiLoader
} from "react-icons/fi";
import { FaFax } from "react-icons/fa";
import { updateCustomer } from "@/app/(crm)/book/[book_id]/customer/[customer_id]/actions";
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

interface CustomerInfoCardProps {
  customer?: Customer | null;
  onCustomerUpdate?: (customer: Customer) => void;
}

export default function CustomerInfoCard({ customer, onCustomerUpdate }: CustomerInfoCardProps) {
  const user = useAuthStore((state) => state.user);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  
  // フォームの状態
  const [formData, setFormData] = useState({
    category: "",
    corporation: "",
    name: "",
    address: "",
    memo: "",
  });

  // 初期データがロードされたかどうか
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 保存前のデータを保持（変更があったかどうかを判定するため）
  const lastSavedData = useRef<typeof formData | null>(null);

  // customerが変更されたらフォームデータを更新
  useEffect(() => {
    if (customer) {
      const newData = {
        category: customer.category || "",
        corporation: customer.corporation || "",
        name: customer.name || "",
        address: customer.address || "",
        memo: customer.memo || "",
      };
      setFormData(newData);
      lastSavedData.current = newData;
      setIsInitialized(true);
    }
  }, [customer]);

  // 保存の実行
  const saveCustomer = useCallback(async () => {
    if (!customer?.id || !user || !isInitialized) return;
    
    // 変更がない場合はスキップ
    if (lastSavedData.current && 
        formData.category === lastSavedData.current.category &&
        formData.corporation === lastSavedData.current.corporation &&
        formData.name === lastSavedData.current.name &&
        formData.address === lastSavedData.current.address &&
        formData.memo === lastSavedData.current.memo) {
      return;
    }

    try {
      const token = await user.getIdToken();
      setSaveStatus("saving");

      startTransition(async () => {
        const result = await updateCustomer(
          {
            id: customer.id,
            category: formData.category,
            corporation: formData.corporation,
            name: formData.name,
            address: formData.address,
            memo: formData.memo,
          },
          token
        );

        if (result.success && result.customer) {
          setSaveStatus("saved");
          // 保存成功したデータを記録
          lastSavedData.current = { ...formData };
          onCustomerUpdate?.(result.customer);
          // 2秒後にステータスをリセット
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
          console.error(result.error);
          setTimeout(() => setSaveStatus("idle"), 3000);
        }
      });
    } catch (error) {
      console.error("Failed to save customer:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [customer?.id, user, isInitialized, formData, onCustomerUpdate]);

  // 入力ハンドラー
  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  // フォーカスが外れたときに保存
  const handleBlur = () => {
    saveCustomer();
  };

  return (
    <Card className="shadow-soft border-0 bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm h-full hover:shadow-lg transition-all duration-300">
      <CardHeader className="flex items-center gap-2">
        <FiUser className="w-5 h-5 text-blue-600" />
        <CardTitle className="text-lg text-gray-900">顧客情報</CardTitle>
        {/* 保存ステータス表示 */}
        <div className="ml-auto flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <FiLoader className="w-4 h-4 animate-spin" />
              保存中...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <FiCheck className="w-4 h-4" />
              保存完了
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-sm text-red-600">保存に失敗しました</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* カテゴリ・業種 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiHome className="w-4 h-4 text-green-600" />
              大カテゴリ
            </label>
            <Input 
              className="group-hover:border-blue-300 transition-colors" 
              value={formData.category}
              onChange={handleInputChange("category")}
              onBlur={handleBlur}
            />
          </div>
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiBriefcase className="w-4 h-4 text-blue-600" />
              業種
            </label>
            <Input 
              className="group-hover:border-green-300 transition-colors" 
              value={formData.category}
              onChange={handleInputChange("category")}
              onBlur={handleBlur}
            />
          </div>
        </div>

        {/* 顧客名 */}
        <div className="space-y-2 group">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FiUser className="w-4 h-4 text-purple-600" />
            法人名
          </label>
          <Input 
            className="w-full group-hover:border-purple-300 transition-colors" 
            value={formData.corporation}
            onChange={handleInputChange("corporation")}
            onBlur={handleBlur}
          />
        </div>
        <div className="space-y-2 group">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <FiUser className="w-4 h-4 text-indigo-600" />
            顧客名
          </label>
          <Input 
            className="w-full group-hover:border-indigo-300 transition-colors" 
            value={formData.name}
            onChange={handleInputChange("name")}
            onBlur={handleBlur}
          />
        </div>

        {/* 住所 */}
        <div className="flex gap-2">
          <div className="space-y-2 flex-1 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiMapPin className="w-4 h-4 text-red-600" />
              都道府県
            </label>
            <Input 
              className="group-hover:border-red-300 transition-colors" 
              value={formData.address}
              onChange={handleInputChange("address")}
              onBlur={handleBlur}
            />
          </div>
          <div className="space-y-2 flex-3 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiMapPin className="w-4 h-4 text-orange-600" />
              住所
            </label>
            <Input 
              className="group-hover:border-orange-300 transition-colors" 
              value={formData.address}
              onChange={handleInputChange("address")}
              onBlur={handleBlur}
            />
          </div>
        </div>

        {/* メール・FAX */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FiMail className="w-4 h-4 text-blue-600" />
              Mail
            </label>
            <Input 
              placeholder="" 
              className="group-hover:border-blue-300 transition-colors" 
            />
          </div>
          <div className="space-y-2 group">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FaFax className="w-4 h-4 text-green-600" />
              FAX
            </label>
            <div className="flex gap-2">
              <Input 
                className="flex-1 group-hover:border-green-300 transition-colors" 
              />
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
              value={formData.memo}
              onChange={handleInputChange("memo")}
              onBlur={handleBlur}
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