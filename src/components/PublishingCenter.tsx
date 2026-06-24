import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Send } from "lucide-react";
import { createUploadPostProfile } from "@/lib/upload-post.functions";
import { ConnectedAccountsTab } from "@/components/publishing/ConnectedAccountsTab";
import { PublishTab } from "@/components/publishing/PublishTab";
import { QueueTab } from "@/components/publishing/QueueTab";
import { HistoryTab } from "@/components/publishing/HistoryTab";
import { DraftsTab } from "@/components/publishing/DraftsTab";
import { AnalyticsTab } from "@/components/publishing/AnalyticsTab";

const routeApi = getRouteApi("/_authenticated/publishing");

const TABS = [
  { value: "accounts", label: "Connected Accounts" },
  { value: "publish", label: "Publish" },
  { value: "queue", label: "Queue" },
  { value: "history", label: "History" },
  { value: "drafts", label: "Drafts" },
  { value: "analytics", label: "Analytics" },
] as const;

export function PublishingCenter() {
  const search = routeApi.useSearch();
  const navigate = useNavigate();
  const createProfileFn = useServerFn(createUploadPostProfile);

  const [tab, setTab] = useState<string>(search.tab ?? "accounts");
  // Bumping this key forces dependent tabs to refetch after a publish/connect.
  const [refreshKey, setRefreshKey] = useState(0);

  // Lazily ensure the Upload-Post profile exists on first visit. Idempotent.
  useEffect(() => {
    createProfileFn().catch(() => {
      /* surfaced contextually inside tabs that need the provider */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (value: string) => {
    setTab(value);
    navigate({
      to: "/publishing",
      search: (prev: Record<string, unknown>) => ({ ...prev, tab: value, connected: undefined }),
      replace: true,
    } as any).catch(() => {});
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-[1100px] px-4 py-8 lg:py-12">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-accent shadow-ig">
            <Send className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Publishing Center</h1>
            <p className="text-sm text-muted-foreground">
              Publish AI-generated content to every platform at once.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-[13px]">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="accounts">
            <ConnectedAccountsTab
              autoSync={!!search.connected}
              onConnectionsChanged={() => setRefreshKey((k) => k + 1)}
            />
          </TabsContent>
          <TabsContent value="publish">
            <PublishTab
              key={`publish-${refreshKey}`}
              initialProjectId={search.projectId}
              onPublished={() => {
                setRefreshKey((k) => k + 1);
                changeTab("queue");
              }}
            />
          </TabsContent>
          <TabsContent value="queue">
            <QueueTab key={`queue-${refreshKey}`} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab key={`history-${refreshKey}`} />
          </TabsContent>
          <TabsContent value="drafts">
            <DraftsTab key={`drafts-${refreshKey}`} onEdit={() => changeTab("publish")} />
          </TabsContent>
          <TabsContent value="analytics">
            <AnalyticsTab />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
