"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { FiSettings } from "react-icons/fi";
import { NavbarSearchBar } from "./NavbarSearchBar";

export default function Navbar() {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    router.push("/logout");
  };

  return (
    <header className="flex justify-between items-center p-4 bg-white shadow-md h-20 gap-4">
      <Link href="/" className="flex items-center flex-shrink-0">
        <span className="text-2xl font-bold text-gray-800">Phox</span>
      </Link>
      <NavbarSearchBar />
      <div className="flex items-center space-x-4 flex-shrink-0">
        {isLoading ? (
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
        ) : isAuthenticated ? (
          <>
            <span className="text-sm text-gray-600 hidden sm:inline">
              {user?.name || user?.email}
            </span>
            <Button variant="ghost" size="icon" asChild title="ユーザー設定">
              <Link href="/settings">
                <FiSettings className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              ログアウト
            </Button>
          </>
        ) : (
          <Button asChild>
            <Link href="/login">ログイン</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
