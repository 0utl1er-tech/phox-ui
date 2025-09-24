import Navbar from "@/components/main/navbar/Navbar";
import CustomerInfoCard from "@/components/crm/detail/CustomerInfoCard";
import ContactInfoCard from "@/components/crm/detail/ContactInfoCard";
import CallManagementCard from "@/components/crm/detail/CallManagementCard";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 ">
      <Navbar />
      <div className="m-5">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 pb-5">
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
      </div>
    </div>
  );
}
