"use client"

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import CustomerInfoCard from "@/components/crm/detail/CustomerInfoCard";
import ContactInfoCard from "@/components/crm/detail/ContactInfoCard";
import ActivityHistoryCard, {
  ActivityHistoryCardRef,
} from "@/components/crm/detail/ActivityHistoryCard";
import { SendEmailDialog } from "@/components/crm/detail/SendEmailDialog";
import { useAuthStore } from "@/store/authStore";
import { updateCustomer } from "@/app/(crm)/book/[book_id]/customer/[customer_id]/actions";

interface Customer {
  id: string;
  bookId: string;
  phone: string;
  category: string;
  name: string;
  corporation: string;
  address: string;
  memo: string;
  mail: string;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.customer_id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendEmailOpen, setIsSendEmailOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const activityHistoryRef = useRef<ActivityHistoryCardRef>(null);

  const handleActivityChanged = useCallback(() => {
    activityHistoryRef.current?.refreshActivities();
  }, []);

  // 代表メール変更ハンドラー
  const handleCustomerMailChange = useCallback(async (mail: string) => {
    if (!customer || !user) return;
    try {
      const token = user.accessToken;
      const result = await updateCustomer({ id: customer.id, mail }, token);
      if (result.success && result.customer) {
        setCustomer(result.customer);
      } else {
        console.error('Failed to update mail:', result.error);
      }
    } catch (error) {
      console.error('Failed to update mail:', error);
    }
  }, [customer, user]);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!user || !customerId) {
        setIsLoading(false);
        return;
      }

      try {
        const token = user.accessToken;
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
            mail: data.customer?.mail || '',
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 ">
      <div className="m-5">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 pb-5">
          {/* 左側の3つのセクション */}
          <div className="space-y-6 lg:col-span-2">
            <CustomerInfoCard
              customer={customer}
              onCustomerUpdate={setCustomer}
            />
          </div>

          {/* 右側のセクション */}
          <div className="space-y-6 lg:col-span-3">
            <ContactInfoCard
              customerId={customerId}
              bookId={customer?.bookId || ""}
              customerPhone={customer?.phone}
              customerMail={customer?.mail}
              onCustomerMailChange={handleCustomerMailChange}
              onCallCreated={handleActivityChanged}
              onSendEmailClick={() => setIsSendEmailOpen(true)}
            />

            <ActivityHistoryCard
              ref={activityHistoryRef}
              customerId={customerId}
              bookId={customer?.bookId || ""}
              customerPhone={customer?.phone}
              onActivityCreated={handleActivityChanged}
              onSendEmailClick={() => setIsSendEmailOpen(true)}
            />
          </div>
        </div>
      </div>

      <SendEmailDialog
        open={isSendEmailOpen}
        onOpenChange={setIsSendEmailOpen}
        customerId={customerId}
        bookId={customer?.bookId || ""}
        customerMail={customer?.mail ?? ""}
        customerName={customer?.name ?? ""}
        customerCorporation={customer?.corporation ?? ""}
        customerPhone={customer?.phone ?? ""}
        onSent={handleActivityChanged}
      />
    </div>
  );
}
