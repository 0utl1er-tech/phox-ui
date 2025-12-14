"use server";

export interface UpdateCustomerData {
  id: string;
  phone?: string;
  category?: string;
  name?: string;
  corporation?: string;
  address?: string;
  memo?: string;
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
