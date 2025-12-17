"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FiUser, FiSave, FiLoader, FiUsers, FiUserPlus } from "react-icons/fi";
import { useAuthStore } from "@/store/authStore";

interface User {
  id: string;
  name: string;
  company?: {
    id: string;
    name: string;
  };
}

export default function UserSettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const authUser = useAuthStore((state) => state.user);

  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!authUser) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const token = await authUser.getIdToken();
      
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      const url = `${apiUrl}/user.v1.UserService/GetMe`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch user: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      setUser(data.user);
      setName(data.user?.name || "");
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An error occurred';
      setError(`エラーが発生しました: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [authUser]);

  const fetchCompanyUsers = useCallback(async () => {
    if (!authUser) {
      return;
    }

    try {
      setIsLoadingUsers(true);
      setUsersError(null);
      const token = await authUser.getIdToken();
      
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      const url = `${apiUrl}/user.v1.UserService/ListCompanyUsers`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch company users: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      setCompanyUsers(data.users || []);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An error occurred';
      setUsersError(`エラーが発生しました: ${errorMessage}`);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [authUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (user?.company) {
      fetchCompanyUsers();
    }
  }, [user?.company, fetchCompanyUsers]);

  const handleSave = async () => {
    if (!authUser || !name.trim()) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);
      const token = await authUser.getIdToken();
      
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      const url = `${apiUrl}/user.v1.UserService/UpdateUser`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update user: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      setUser(data.user);
      setSuccessMessage("ユーザー情報を更新しました");
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An error occurred';
      setError(`エラーが発生しました: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddUser = async () => {
    if (!authUser || !newUserId.trim() || !newUserName.trim()) {
      return;
    }

    try {
      setIsAddingUser(true);
      setAddUserError(null);
      setAddUserSuccess(null);
      const token = await authUser.getIdToken();
      
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';
      const url = `${apiUrl}/user.v1.UserService/AddCompanyUser`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: newUserId.trim(),
          name: newUserName.trim(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add user: ${response.statusText} - ${errorText}`);
      }

      setAddUserSuccess("ユーザーを追加しました");
      setNewUserId("");
      setNewUserName("");
      fetchCompanyUsers();
      
      setTimeout(() => setAddUserSuccess(null), 3000);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An error occurred';
      setAddUserError(`エラーが発生しました: ${errorMessage}`);
    } finally {
      setIsAddingUser(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ユーザー設定</h1>
          <p className="text-gray-600 mt-2">アカウント情報を編集できます</p>
        </div>

        <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FiUser className="w-5 h-5" />
              プロフィール
            </CardTitle>
            <CardDescription>
              ユーザー名やその他の情報を編集します
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <FiLoader className="w-6 h-6 animate-spin text-gray-500" />
                <span className="ml-2 text-gray-500">読み込み中...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600">{error}</p>
              </div>
            ) : !authUser ? (
              <p className="text-gray-500">ログインしてください。</p>
            ) : (
              <div className="space-y-6">
                {successMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-600">{successMessage}</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <label htmlFor="userId" className="text-sm font-medium text-gray-700">
                    ユーザーID
                  </label>
                  <Input
                    id="userId"
                    value={user?.id || ""}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500">ユーザーIDは変更できません</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-gray-700">
                    ユーザー名
                  </label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ユーザー名を入力"
                  />
                </div>

                {user?.company && (
                  <div className="space-y-2">
                    <label htmlFor="company" className="text-sm font-medium text-gray-700">
                      会社名
                    </label>
                    <Input
                      id="company"
                      value={user.company.name}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !name.trim()}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                  >
                    {isSaving ? (
                      <>
                        <FiLoader className="w-4 h-4 animate-spin mr-2" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <FiSave className="w-4 h-4 mr-2" />
                        保存
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {user?.company && (
          <>
            <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <FiUserPlus className="w-5 h-5" />
                  ユーザーを追加
                </CardTitle>
                <CardDescription>
                  会社に新しいユーザーを追加します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {addUserError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-600">{addUserError}</p>
                    </div>
                  )}
                  {addUserSuccess && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-600">{addUserSuccess}</p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <label htmlFor="newUserId" className="text-sm font-medium text-gray-700">
                      Firebase UID
                    </label>
                    <Input
                      id="newUserId"
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      placeholder="新しいユーザーのFirebase UIDを入力"
                    />
                    <p className="text-xs text-gray-500">追加するユーザーのFirebase認証UIDを入力してください</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="newUserName" className="text-sm font-medium text-gray-700">
                      ユーザー名
                    </label>
                    <Input
                      id="newUserName"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="新しいユーザーの名前を入力"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={handleAddUser}
                      disabled={isAddingUser || !newUserId.trim() || !newUserName.trim()}
                      className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                    >
                      {isAddingUser ? (
                        <>
                          <FiLoader className="w-4 h-4 animate-spin mr-2" />
                          追加中...
                        </>
                      ) : (
                        <>
                          <FiUserPlus className="w-4 h-4 mr-2" />
                          ユーザーを追加
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <FiUsers className="w-5 h-5" />
                  会社のユーザー一覧
                </CardTitle>
                <CardDescription>
                  {user.company.name} に所属しているユーザー
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="flex justify-center items-center py-8">
                    <FiLoader className="w-6 h-6 animate-spin text-gray-500" />
                    <span className="ml-2 text-gray-500">読み込み中...</span>
                  </div>
                ) : usersError ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600">{usersError}</p>
                  </div>
                ) : companyUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">ユーザーがいません</p>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {companyUsers.map((companyUser) => (
                      <div key={companyUser.id} className="py-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{companyUser.name}</p>
                          <p className="text-sm text-gray-500">{companyUser.id}</p>
                        </div>
                        {companyUser.id === user?.id && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            あなた
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
