import { create } from "zustand";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082";

interface BookNavState {
  // --- cached data (keyed by bookId) ---
  cachedBookId: string;
  bookName: string;
  allBooks: { id: string; name: string }[];
  siblingIds: string[];
  totalCount: number;
  /** true while the very first fetch for a bookId is in flight */
  isLoading: boolean;

  // --- actions ---
  /** Load book data. If bookId matches cache, skip fetch. */
  load: (bookId: string, accessToken: string) => void;
  /** Force-refresh (e.g. after customer creation) */
  invalidate: () => void;
}

export const useBookNavStore = create<BookNavState>((set, get) => ({
  cachedBookId: "",
  bookName: "",
  allBooks: [],
  siblingIds: [],
  totalCount: 0,
  isLoading: false,

  load: (bookId: string, accessToken: string) => {
    // Already loaded for this book — skip
    if (get().cachedBookId === bookId && get().siblingIds.length > 0) return;
    // Already fetching for this book
    if (get().cachedBookId === bookId && get().isLoading) return;

    set({ cachedBookId: bookId, isLoading: true });

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    // Fire 3 requests in parallel
    const fetchSiblings = fetch(`${API_URL}/customer.v1.CustomerService/ListCustomer`, {
      method: "POST",
      headers,
      body: JSON.stringify({ book_id: bookId, limit: 10000, offset: 0 }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const fetchBook = fetch(`${API_URL}/book.v1.BookService/GetBook`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id: bookId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const fetchAllBooks = fetch(`${API_URL}/book.v1.BookService/ListBooks`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    Promise.all([fetchSiblings, fetchBook, fetchAllBooks]).then(
      ([siblingsData, bookData, allBooksData]) => {
        // Guard: if bookId changed while we were fetching, discard
        if (get().cachedBookId !== bookId) return;

        const ids = (siblingsData?.customers || []).map((c: any) => c.id);
        const total =
          siblingsData?.total_count ?? siblingsData?.totalCount ?? ids.length;
        const name = bookData?.book?.name ?? bookData?.name ?? "";
        const books = (allBooksData?.books || []).map((b: any) => ({
          id: b.id,
          name: b.name,
        }));

        set({
          siblingIds: ids,
          totalCount: total,
          bookName: name,
          allBooks: books,
          isLoading: false,
        });
      },
    );
  },

  invalidate: () => {
    set({ cachedBookId: "", siblingIds: [], totalCount: 0 });
  },
}));
