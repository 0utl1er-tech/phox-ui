"use server";

export interface UpdateCustomerData {
  id: string;
  phone?: string;
  category?: string;
  name?: string;
  corporation?: string;
  address?: string;
  memo?: string;
  mail?: string;
}

export interface UpdateCustomerResult {
  success: boolean;
  error?: string;
  customer?: {
    id: string;
    bookId: string;
    phone: string;
    category: string;
    name: string;
    corporation: string;
    address: string;
    memo: string;
    mail: string;
    // Phase 29b: 差し込み変数。この action では更新しないが、更新後の
    // customer をそのまま state に載せる呼び出し元があるため、返り値から
    // 落とすと画面上の一覧が消えてしまう。
    customFields: Record<string, string>;
  };
}

export async function updateCustomer(
  data: UpdateCustomerData,
  token: string
): Promise<UpdateCustomerResult> {
  try {
    // Server Actions用のBACKEND_URLを優先、なければNEXT_PUBLIC_BACKEND_URLを使用
    const apiUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8082";

    const response = await fetch(
      `${apiUrl}/customer.v1.CustomerService/UpdateCustomer`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `更新に失敗しました: ${errorText}`,
      };
    }

    const result = await response.json();
    const updatedCustomer = result.updated_customer || result.updatedCustomer;

    return {
      success: true,
      customer: {
        id: updatedCustomer?.id || "",
        bookId: updatedCustomer?.book_id || updatedCustomer?.bookId || "",
        phone: updatedCustomer?.phone || "",
        category: updatedCustomer?.category || "",
        name: updatedCustomer?.name || "",
        corporation: updatedCustomer?.corporation || "",
        address: updatedCustomer?.address || "",
        memo: updatedCustomer?.memo || "",
        mail: updatedCustomer?.mail || "",
        customFields:
          updatedCustomer?.custom_fields || updatedCustomer?.customFields || {},
      },
    };
  } catch (error) {
    console.error("Failed to update customer:", error);
    return {
      success: false,
      error: "更新中にエラーが発生しました",
    };
  }
}
