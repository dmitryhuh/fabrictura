import Logo from "@/components/Logo";

export default function AuthLayout({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className="min-h-screen grid place-items-center p-4 text-ink"
      style={{
        background:
          "radial-gradient(circle at 15% 10%, #DCEEFC 0, transparent 45%), radial-gradient(circle at 85% 90%, #E6F3FD 0, transparent 45%), #F4F7FA",
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-xl shadow-brand/10">
        <div className="mb-6 flex justify-center">
          <Logo size={48} />
        </div>
        {title && <h1 className="mb-6 text-center text-xl font-bold">{title}</h1>}
        {children}
      </div>
    </main>
  );
}