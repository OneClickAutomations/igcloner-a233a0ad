import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";

export function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from("profiles").select("*").eq("id", data.user.id).single().then(({ data: p }) => {
        setProfile(p);
        setFullName(p?.full_name || "");
      });
    });
  }, []);

  const handleUpdateProfile = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", userData.user.id);
    setLoading(false);
    if (error) toast.error("Failed to update");
    else toast.success("Profile updated");
  };

  const handleDeleteAccount = async () => {
    if (!confirm("This will permanently delete your account and all data. Are you sure?")) return;
    toast.error("Account deletion is not available. Please contact support.");
  };

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-2xl px-4 py-8 lg:py-12">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="font-semibold">Profile</h2>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <p className="text-sm text-muted-foreground">{profile?.id ? "Managed via auth" : "Loading..."}</p>
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <p className="text-sm font-medium capitalize">{profile?.plan || "free"}</p>
              </div>
              <Button onClick={handleUpdateProfile} disabled={loading} className="gap-1">
                <Save className="h-4 w-4" />
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold text-status-error mb-2">Danger Zone</h2>
              <p className="text-sm text-muted-foreground mb-4">Once you delete your account, there is no going back.</p>
              <Button variant="destructive" size="sm" className="gap-1" onClick={handleDeleteAccount}>
                <Trash2 className="h-4 w-4" />
                Delete Account
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold mb-2">Current Plan</h2>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg font-bold capitalize">{profile?.plan || "Free"}</p>
                  <p className="text-sm text-muted-foreground">{profile?.plan === "pro" ? "$49/mo" : profile?.plan === "creator" ? "$19/mo" : "$0"}</p>
                </div>
                <Button variant="outline" size="sm">Upgrade</Button>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Analyses used</span>
                  <span className="font-medium">{profile?.analyses_used || 0} / {profile?.analyses_limit || 10}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent-primary transition-all"
                    style={{ width: `${Math.min(((profile?.analyses_used || 0) / (profile?.analyses_limit || 10)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-semibold mb-4">Invoice History</h2>
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
