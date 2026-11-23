import { Suspense } from "react";
import AppShell from "@/components/AppShell";

export const instant = false;

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center bg-canvas text-muted">
          Загрузка...
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}