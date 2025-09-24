import { create } from 'zustand';

interface Customer {
  id: string;
  name: string;
  corporation: string;
  address: string;
  memo?: string;
}

interface CustomerStore {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  currentBookId: string | null;
  lastFetchedBookId: string | null;
  fetchCustomers: (bookId: string) => Promise<void>;
  setCustomers: (customers: Customer[]) => void;
  clearCustomers: () => void;
  setCurrentBookId: (bookId: string) => void;
}

export const useCustomerStore = create<CustomerStore>((set) => ({
  customers: [],
  loading: false,
  error: null,
  currentBookId: null,
  lastFetchedBookId: null,
  
  fetchCustomers: async (bookId: string) => {
    // 同じbookIdの場合は再読み込みしない
    const state = useCustomerStore.getState();
    if (state.lastFetchedBookId === bookId && state.customers.length > 0) {
      console.log('Using cached data for bookId:', bookId);
      return;
    }
    
    set({ loading: true, error: null });
    
    try {
      // UUID形式の検証
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(bookId)) {
        throw new Error(`Invalid UUID format: ${bookId}. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);
      }
      
      console.log('Fetching customers for bookId:', bookId);
      
      const response = await fetch(`/api/customers/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          bookId: bookId
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('API Response:', data);
      set({ 
        customers: data.customers || [], 
        loading: false,
        lastFetchedBookId: bookId
      });
    } catch (error) {
      console.error('Fetch error:', error);
      
      // デバッグ用: APIが利用できない場合はダミーデータを返す
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        console.log('Using fallback data for development');
        const fallbackData = {
          customers: [
            {
              id: "c56bb311-dfff-42b4-b3de-846b44580689",
              name: "ｉ　ｇａｒｅｇｅ",
              corporation: "藤倉一",
              address: "埼玉県さいたま市見沼区膝子２７５－１",
              memo: "若めの男性：藤倉さんはもう帰って明日のAMならいるかもしれないと\n\n10:00-"
            },
            {
              id: "61435a46-7b82-49c6-8d23-6483ed67e87c",
              name: "株式会社久田商会",
              corporation: "株式会社久田商会",
              address: "愛知県名古屋市千種区千種３－２９－２０",
              memo: "株式会社久田商会　愛知県名古屋市千種区千種３－２９－２０\n\n\n\n"
            },
            {
              id: "36c561f9-cf97-486a-8c2b-d1e3528e8618",
              name: "ひつじのたまっこ　Ｓａｏｒｉｎ　Ｋｎｉｔ",
              corporation: "井上　さおり",
              address: "愛知県津島市天王通３丁目３－２７",
              memo: "再コール　公式あり　友だち50人　RMなし\n\n井上　さおり\n\n何度か連絡した時に授業中で話せずにいる"
            }
          ]
        };
        set({ 
          customers: fallbackData.customers, 
          loading: false,
          lastFetchedBookId: bookId
        });
        return;
      }
      
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred', 
        loading: false 
      });
    }
  },

  setCustomers: (customers: Customer[]) => {
    set({ customers });
  },

  clearCustomers: () => {
    set({ customers: [], error: null });
  },

  setCurrentBookId: (bookId: string) => {
    set({ currentBookId: bookId });
  },
})); 