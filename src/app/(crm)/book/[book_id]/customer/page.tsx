import { redirect } from "next/navigation";

interface CustomerPageProps {
  params: Promise<{ book_id: string }>;
}

export default async function CustomerPage({ params }: CustomerPageProps) {
  const { book_id } = await params;
  redirect(`/book/${book_id}`);
}
