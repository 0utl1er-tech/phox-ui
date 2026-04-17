"use client"

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaRegAddressBook } from "react-icons/fa";
import { FiUpload, FiPlus } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";
import { ContactImportDialog } from "@/components/crm/contact-import-dialog";
import { PhoneInput, PhoneLink } from "@/components/ui/phone-input";
import { MailInput } from "@/components/ui/mail-input";

interface Contact {
  id: string;
  customerId: string;
  name: string;
  sex: string;
  phone: string;
  mail: string;
  fax: string;
}

interface ContactInfoCardProps {
  customerId: string;
  bookId: string;
  customerPhone?: string;
  customerMail?: string;
  onPhoneChange?: (phone: string) => void;
  onCustomerMailChange?: (mail: string) => void;
  onCallCreated?: () => void;
  onSendEmailClick?: () => void;
}

export default function ContactInfoCard({
  customerId,
  bookId,
  customerPhone,
  customerMail,
  onPhoneChange,
  onCustomerMailChange,
  onCallCreated,
  onSendEmailClick,
}: ContactInfoCardProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  const fetchContacts = useCallback(async () => {
    if (!user || !customerId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = user.accessToken;
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/contact.v1.ContactService/ListContact`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customer_id: customerId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`連絡先の取得に失敗しました: ${errorText}`);
      }

      const data = await response.json();
      const contactList = (data.contacts || []).map((c: any) => ({
        id: c.id,
        customerId: c.customer_id || c.customerId,
        name: c.name || '',
        sex: c.sex || '',
        phone: c.phone || '',
        mail: c.mail || '',
        fax: c.fax || '',
      }));
      setContacts(contactList);
    } catch (e: any) {
      console.error('Fetch error:', e);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [user, customerId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleImportSuccess = useCallback(() => {
    fetchContacts();
  }, [fetchContacts]);

  return (
    <>
      <Card className="border border-gray-200 bg-white rounded-2xl shadow-sm">
        <CardContent className="p-5 space-y-4">
          {/* 代表者情報 */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900 pb-2 border-b border-gray-100">連絡先</h2>
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">代表者情報</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PhoneInput
                value={customerPhone || ''}
                onChange={onPhoneChange}
                readOnly={!onPhoneChange}
                placeholder="電話番号を入力"
                customerId={customerId}
                bookId={bookId}
                onCallCreated={onCallCreated}
              />
              <MailInput
                value={customerMail || ''}
                onChange={onCustomerMailChange}
                readOnly={!onCustomerMailChange}
                placeholder="メールアドレスを入力"
                onOpenSendDialog={onSendEmailClick}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-3">
            <label className="font-medium text-gray-700">連絡先一覧</label>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsImportDialogOpen(true)}
              >
                <FiUpload className="w-4 h-4 mr-1" />
                CSVインポート
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="border-gray-300 hover:bg-blue-450 bg-blue-500 text-white"
              >
                <FiPlus className="w-4 h-4 mr-1" />
                新規作成
              </Button>
            </div>
          </div>

          <div className="border rounded-2xl overflow-hidden mt-3">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b">
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">担当者名</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">メール</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">電話番号</TableHead>
                  <TableHead className="text-gray-500 font-medium text-xs uppercase tracking-wider">FAX</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      読み込み中...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-red-500">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      連絡先がありません
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow key={contact.id} className="hover:bg-gray-50">
                      <TableCell>{contact.name || '-'}</TableCell>
                      <TableCell>{contact.mail || '-'}</TableCell>
                      <TableCell>
                        <PhoneLink 
                          phone={contact.phone}
                          customerId={customerId}
                          bookId={bookId}
                          onCallCreated={onCallCreated}
                        />
                      </TableCell>
                      <TableCell>{contact.fax || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ContactImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        customerId={customerId}
        onImportSuccess={handleImportSuccess}
      />
    </>
  );
}
