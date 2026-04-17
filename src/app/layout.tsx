import type { Metadata } from "next";
import { Inter, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/main/auth/AuthProvider";
import Navbar from "@/components/main/navbar/Navbar";
import { IncomingCallToast } from "@/components/crm/IncomingCallToast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "顧客管理ダッシュボード | Prism",
  description: "モダンな顧客管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen`}
      >
        <AuthProvider>
          <Navbar />
          <IncomingCallToast />
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
