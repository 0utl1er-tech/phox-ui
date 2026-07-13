"use client";

// メール一覧ページ (Phase 26)。
// 自分が viewer 以上のメールボックスの送受信メールを Activity フィードの
// 要領で一覧する。実体は MailboxInbox コンポーネント。

import MailboxInbox from "@/components/crm/mailbox-inbox";

export default function MailsPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <MailboxInbox />
    </div>
  );
}
