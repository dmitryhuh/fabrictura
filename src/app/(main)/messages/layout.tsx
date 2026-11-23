
"use client";

import { usePathname } from "next/navigation";
import ConversationList from "@/components/ConversationList";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  const activeId = pathname.split("/")[2] ?? null;

  return (
    <div className="md:grid md:h-[calc(100dvh-2rem)] md:grid-cols-[320px_1fr] md:grid-rows-1 md:gap-4 lg:grid-cols-[360px_1fr]">
      <aside
        className={`${
          activeId ? "hidden" : "block"
        } overflow-hidden rounded-xl border border-line bg-white md:flex md:min-h-0 md:flex-col`}
      >
        <ConversationList activeId={activeId} />
      </aside>

      <section className={`${activeId ? "block" : "hidden"} md:block md:h-full md:min-h-0`}>
        {children}
      </section>
    </div>
  );
}