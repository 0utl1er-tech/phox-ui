"use client";

import { withAuth } from "@/components/main/auth/withAuth";
import CustomerInfoCard from "@/components/crm/detail/CustomerInfoCard";
import ContactInfoCard from "@/components/crm/detail/ContactInfoCard";
import CallManagementCard from "@/components/crm/detail/CallManagementCard";

function HomePage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* 左側の3つのセクション */}
      <div className="space-y-6 lg:col-span-2">
        {/* 顧客情報セクション */}
        <CustomerInfoCard />
      </div>

      {/* 右側のセクション */}
      <div className="space-y-6 lg:col-span-3">
        {/* 連絡先情報セクション */}
        <ContactInfoCard />

        {/* コール担当セクション */}
        <CallManagementCard />
      </div>
    </div>
  );
}

export default withAuth(HomePage);
