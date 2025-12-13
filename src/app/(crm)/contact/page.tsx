"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactMasterImportDialog } from "@/components/crm/contact-master-import-dialog";
import { FiUpload, FiPhone, FiMail, FiUser } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";

interface Contact {
  id: string;
  customerId: string;
  name: string;
  sex: string;
  phone: string;
  mail: string;
  fax: string;
}

interface Customer {
  id: string;
  name: string;
  corporation: string;
}

interface ContactWithCustomer extends Contact {
  customer?: Customer;
}

export default function ContactListPage() {
  const [contacts, setContacts] = useState<ContactWithCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const user = useAuthStore((state) => state.user);

  const fetchContacts = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const token = await user.getIdToken();
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      
      const response = await fetch(`${apiUrl}/contact.v1.ContactService/ListAllContacts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
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
        customer: c.customer ? {
          id: c.customer.id || '',
          name: c.customer.name || '',
          corporation: c.customer.corporation || '',
        } : undefined,
      }));
      setContacts(contactList);
    } catch (e: any) {
      console.error('Fetch error:', e);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleImportSuccess = useCallback(() => {
    fetchContacts();
  }, [fetchContacts]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">連絡先マスター</h1>
              <p className="text-gray-600 mt-1">全ての連絡先情報を管理します</p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => setIsImportDialogOpen(true)}
              >
                <FiUpload className="w-4 h-4 mr-2" />
                CSVインポート
              </Button>
            </div>
          </div>
        </div>

        <Card className="shadow-soft border-0 bg-gradient-to-br from-white to-blue-50/30 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <FiPhone className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg text-gray-900">連絡先一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">読み込み中...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-500">{error}</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={fetchContacts}
                >
                  再読み込み
                </Button>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12">
                <FiUser className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">連絡先がまだありません</p>
                <Button 
                  variant="outline"
                  onClick={() => setIsImportDialogOpen(true)}
                >
                  <FiUpload className="w-4 h-4 mr-2" />
                  CSVインポートで追加
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-blue-800 to-blue-900">
                      <TableHead className="text-white font-medium">顧客</TableHead>
                      <TableHead className="text-white font-medium">担当者名</TableHead>
                      <TableHead className="text-white font-medium">性別</TableHead>
                      <TableHead className="text-white font-medium">電話番号</TableHead>
                      <TableHead className="text-white font-medium">メール</TableHead>
                      <TableHead className="text-white font-medium">FAX</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="font-medium">
                          {contact.customer?.corporation || contact.customer?.name || contact.customerId.slice(0, 8) + '...'}
                        </TableCell>
                        <TableCell>{contact.name || '-'}</TableCell>
                        <TableCell>{contact.sex || '-'}</TableCell>
                        <TableCell>{contact.phone || '-'}</TableCell>
                        <TableCell>
                          {contact.mail ? (
                            <a href={`mailto:${contact.mail}`} className="text-blue-600 hover:underline">
                              {contact.mail}
                            </a>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{contact.fax || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ContactMasterImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
