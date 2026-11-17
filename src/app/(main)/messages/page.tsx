import { MessageCircle } from "lucide-react";

export default function MessagesIndexPage() {
  return (
    <div className="grid h-full place-items-center rounded-xl border border-line bg-white p-8 text-center text-muted">
      <div className="flex flex-col items-center gap-3">
        <MessageCircle size={36} strokeWidth={1.6} />
        <p>Выберите диалог слева или напишите человеку из его профиля.</p>
      </div>
    </div>
  );
}