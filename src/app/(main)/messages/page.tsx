// ПУТЬ: src/app/(main)/messages/page.tsx
import { MessageCircle } from "lucide-react";

export default function MessagesIndexPage() {
  return (
    <div className="grid h-full place-items-center rounded-xl border border-line bg-white p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <MessageCircle size={36} strokeWidth={1.6} className="text-muted" />
        <p className="rounded-full bg-brand-soft px-4 py-1.5 text-sm text-muted">
          Выберите чат, чтобы начать переписку
        </p>
      </div>
    </div>
  );
}