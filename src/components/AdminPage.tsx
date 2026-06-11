import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sparkles, ArrowLeft, Users, BarChart3, Activity, CreditCard } from "lucide-react";

export function AdminPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ users: 0, mrr: 0, today: 0, credits: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setLoading(true);
    // Use service role via server function in production; for now use client with RLS
    const { data: allUsers } = await supabase.from("profiles").select("*");
    const { data: allAnalyses } = await supabase.from("analyses").select("created_at");
    const today = allAnalyses?.filter((a) => a.created_at && new Date(a.created_at).toDateString() === new Date().toDateString()).length || 0;

    setUsers(allUsers || []);
    setStats({
      users: allUsers?.length || 0,
      mrr: (allUsers?.filter((u) => u.plan === "pro").length || 0) * 49 + (allUsers?.filter((u) => u.plan === "creator").length || 0) * 19,
      today,
      credits: allUsers?.reduce((sum, u) => sum + (u.analyses_used || 0), 0) || 0,
    });
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 lg:px-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate({ to: "/app" })}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <span className="text-sm font-medium text-muted-foreground">Admin Panel</span>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-8 lg:py-12">
        <h1 className="text-2xl font-bold mb-8">Admin Dashboard</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Users", value: stats.users, icon: Users },
            { label: "MRR", value: `$${stats.mrr}`, icon: CreditCard },
            { label: "Analyses Today", value: stats.today, icon: Activity },
            { label: "Credits Used", value: stats.credits, icon: BarChart3 },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <stat.icon className="h-5 w-5 text-muted-foreground mb-2" />
              <p className="text-2xl font-bold font-mono text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-4">Users</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Name</th>
                    <th className="pb-2 text-left font-medium">Plan</th>
                    <th className="pb-2 text-left font-medium">Used</th>
                    <th className="pb-2 text-left font-medium">Role</th>
                    <th className="pb-2 text-left font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/50">
                      <td className="py-2">{u.full_name || "—"}</td>
                      <td className="py-2 capitalize">{u.plan || "free"}</td>
                      <td className="py-2">{u.analyses_used ?? 0} / {u.analyses_limit ?? 3}</td>
                      <td className="py-2 capitalize">{u.role || "user"}</td>
                      <td className="py-2 text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
