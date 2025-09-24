"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FiSearch, 
  FiFilter, 
  FiChevronDown, 
  FiChevronUp,
  FiX,
  FiUser,
  FiMapPin,
  FiBriefcase
} from "react-icons/fi";

interface SearchSidebarProps {
  onSearch: (bookId: string) => void;
  currentBookId: string | null;
  loading: boolean;
}

export default function SearchSidebar({ onSearch, currentBookId, loading }: SearchSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [bookId, setBookId] = useState(currentBookId || "");
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
  ]);

  const handleSearch = () => {
    if (bookId.trim()) {
      onSearch(bookId.trim());
      // 最近の検索に追加（重複を避ける）
      if (!recentSearches.includes(bookId.trim())) {
        setRecentSearches(prev => [bookId.trim(), ...prev.slice(0, 4)]);
      }
    }
  };

  const handleRecentSearch = (recentBookId: string) => {
    setBookId(recentBookId);
    onSearch(recentBookId);
  };

  const removeRecentSearch = (bookIdToRemove: string) => {
    setRecentSearches(prev => prev.filter(id => id !== bookIdToRemove));
  };

  return (
    <div className={`bg-white shadow-lg border-r border-gray-200 transition-all duration-300 ${
      isExpanded ? 'w-80' : 'w-16'
    }`}>
      {isExpanded ? (
        <div className="p-4">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">検索条件</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1"
            >
              <FiChevronUp className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* Book ID 検索 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <FiBriefcase className="w-4 h-4" />
                  Book ID
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Book IDを入力"
                    value={bookId}
                    onChange={(e) => setBookId(e.target.value)}
                    className="pl-10"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button 
                  onClick={handleSearch}
                  disabled={loading || !bookId.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                >
                  {loading ? "検索中..." : "検索"}
                </Button>
              </CardContent>
            </Card>

            {/* 最近の検索 */}
            {recentSearches.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <FiFilter className="w-4 h-4" />
                    最近の検索
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recentSearches.map((recentBookId, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <button
                          onClick={() => handleRecentSearch(recentBookId)}
                          className="flex-1 text-left text-sm text-gray-700 hover:text-blue-600 truncate"
                        >
                          {recentBookId}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRecentSearch(recentBookId)}
                          className="p-1 h-6 w-6"
                        >
                          <FiX className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 現在の状態 */}
            {currentBookId && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <FiUser className="w-4 h-4" />
                    現在の状態
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Book ID:</span>
                      <Badge variant="outline" className="text-xs">
                        {currentBookId}
                      </Badge>
                    </div>
                    {loading && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                        <span className="text-sm text-blue-600">読み込み中...</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-full"
            title="検索条件を展開"
          >
            <FiSearch className="w-5 h-5 text-gray-600" />
          </Button>
        </div>
      )}
    </div>
  );
} 