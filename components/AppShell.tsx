import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="flex-1 p-8">
          <Header />
          {children}
        </section>
      </div>
    </main>
  );
}