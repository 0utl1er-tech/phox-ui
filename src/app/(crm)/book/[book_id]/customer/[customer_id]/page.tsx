"use client"

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import CustomerInfoCard from "@/components/crm/detail/CustomerInfoCard";
import ContactInfoCard from "@/components/crm/detail/ContactInfoCard";
import CallManagementCard from "@/components/crm/detail/CallManagementCard";
import { useAuthStore } from "@/store/authStore";
import { updateCustomer } from "./actions";

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

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.customer_id as string;
  const bookId = params.book_id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!user || !customerId) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();
        const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
        
        const response = await fetch(`${apiUrl}/customer.v1.CustomerService/GetCustomer`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: customerId }),
        });

        if (response.ok) {
          const data = await response.json();
          setCustomer({
            id: data.customer?.id || '',
            bookId: data.customer?.book_id || data.customer?.bookId || '',
            phone: data.customer?.phone || '',
            category: data.customer?.category || '',
            name: data.customer?.name || '',
            corporation: data.customer?.corporation || '',
            address: data.customer?.address || '',
            memo: data.customer?.memo || '',
          });
        }
      } catch (e) {
        console.error('Failed to fetch customer:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomer();
  }, [user, customerId]);

  // 電話番号変更ハンドラー
  const handlePhoneChange = useCallback(async (phone: string) => {
    if (!customer || !user) return;
    
    try {
      const token = await user.getIdToken();
      const result = await updateCustomer(
        {
          id: customer.id,
          phone: phone,
        },
        token
      );
      
      if (result.success && result.customer) {
        setCustomer(result.customer);
      } else {
        console.error('Failed to update phone:', result.error);
      }
    } catch (error) {
      console.error('Failed to update phone:', error);
    }
  }, [customer, user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 ">
      <div className="m-5">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 pb-5">
          {/* 左側の3つのセクション */}
          <div className="space-y-6 lg:col-span-2">
            {/* 顧客情報セクション */}
            <CustomerInfoCard 
              customer={customer} 
              onCustomerUpdate={setCustomer}
            />
          </div>

          {/* 右側のセクション */}
          <div className="space-y-6 lg:col-span-3">
            {/* 連絡先情報セクション */}
            <ContactInfoCard 
              customerId={customerId} 
              customerPhone={customer?.phone}
              onPhoneChange={handlePhoneChange}
            />
            
            {/* コール履歴セクション */}
            <CallManagementCard 
              customerId={customerId}
              bookId={bookId}
              customerPhone={customer?.phone}
              onPhoneChange={handlePhoneChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
