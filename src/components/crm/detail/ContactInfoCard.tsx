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
  customerPhone?: string;
}

export default function ContactInfoCard({ customerId, customerPhone }: ContactInfoCardProps) {
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
      const token = await user.getIdToken();
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
      <Card className="shadow-soft border-0 bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
        <CardHeader className="flex items-center gap-2">
          <FaRegAddressBook className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-lg text-gray-900">連絡先情報</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">

          {/* 代表番号 */}
          <div className="space-y-2">
            <label className="font-medium text-gray-700">代表番号</label>
            <div className="flex gap-2">
              <Input className="flex-1" value={customerPhone || ''} readOnly />
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

          <div className="border rounded-lg overflow-hidden mt-3">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-blue-800 to-blue-900 text-white">
                  <TableHead className="text-white font-medium">担当者名</TableHead>
                  <TableHead className="text-white font-medium">メール</TableHead>
                  <TableHead className="text-white font-medium">電話番号</TableHead>
                  <TableHead className="text-white font-medium">FAX</TableHead>
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
                      <TableCell>{contact.phone || '-'}</TableCell>
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
