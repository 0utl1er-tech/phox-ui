"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { FiSettings } from "react-icons/fi";

export default function Navbar() {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <header className="flex justify-between items-center p-4 bg-white shadow-md h-20">
      <Link href="/" className="flex items-center">
        <span className="text-2xl font-bold text-gray-800">Phox</span>
      </Link>
      <div className="flex items-center space-x-4">
        {isLoading ? (
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
        ) : isAuthenticated ? (
          <>
            <span className="text-sm text-gray-600 hidden sm:inline">
              {user?.displayName || user?.email}
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
