import Logo from "@/components/Logo";

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen grid md:grid-cols-2 bg-canvas text-ink">
      <section className="hidden md:flex flex-col justify-between p-12 text-white bg-linear-to-br from-brand via-brand-strong to-brand-deep relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <Logo size={44} white />
          <span className="text-2xl font-bold tracking-tight">Fabrictura</span>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight">
            Общение, лента и подарки — в одном месте
          </h2>
          <p className="mt-4 text-white/80 max-w-md">
            Пишите посты, находите людей, дружите и дарите подарки.
          </p>
        </div>
        <p className="relative text-sm text-white/60">© Fabrictura</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden flex items-center gap-2 mb-8">
            <Logo size={36} />
            <span className="text-xl font-bold">Fabrictura</span>
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted mt-1 mb-6">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}