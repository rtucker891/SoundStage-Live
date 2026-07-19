import AppShell from "@/components/AppShell";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { requireUser } from "@/lib/supabaseServer";

export default async function DashboardPage() {
  // Defense in depth behind the proxy: redirect to /login if not signed in.
  await requireUser();

  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
