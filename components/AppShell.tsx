import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f4f5fb] text-slate-950">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar />

        <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Header />
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </section>
      </div>
    </main>
  );
}
