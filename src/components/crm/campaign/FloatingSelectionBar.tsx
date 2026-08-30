"use client";

// Phase 27a: 顧客一覧/検索結果で選択があるときに表示する
// 画面下部フローティングアクションバー。

import { useRouter } from "next/navigation";
import { FiSend, FiX } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { useCampaignSelectionStore } from "@/store/campaign-selection";

export default function FloatingSelectionBar() {
  const router = useRouter();
  const count = useCampaignSelectionStore((s) => s.selected.size);
  const clear = useCampaignSelectionStore((s) => s.clear);

  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-0 right-0 z-40 px-4 pointer-events-none">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <div className="bg-gray-900/95 backdrop-blur-sm text-white rounded-2xl shadow-xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-medium tabular-nums">
            {count.toLocaleString()} 件選択中
          </span>
          <div className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            <FiX className="w-4 h-4 mr-1" />
            選択をクリア
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push("/campaigns/new")}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          >
            <FiSend className="w-4 h-4 mr-1" />
            キャンペーン作成
          </Button>
        </div>
      </div>
    </div>
  );
}
