import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Plus, Sparkles, Rocket, Microscope, Trash2, Calendar as CalIcon,
  LayoutGrid, List as ListIcon, Layers3, ChevronRight,
  Target, Users, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CampaignWizard } from "@/components/CampaignWizard";
import { CampaignItemDrawer, type CampaignItem } from "@/components/CampaignItemDrawer";
import {
  listCampaigns, getCampaign, deleteCampaign,
} from "@/lib/campaigns.functions";
import { updateCalendarItem } from "@/lib/analyze.functions";

const TYPE_STYLES: Record<string, string> = {
  Reel: "bg-accent-primary/10 text-accent-primary border-accent-primary/30",
  Carousel: "bg-accent-secondary/10 text-accent-secondary border-accent-secondary/30",
  Post: "bg-status-success/10 text-status-success border-status-success/30",
  Story: "bg-status-warning/10 text-status-warning border-status-warning/30",
};
const STATUS_STYLES: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  drafted: "bg-accent-primary/10 text-accent-primary",
  scheduled: "bg-status-warning/10 text-status-warning",
  posted: "bg-status-success/10 text-status-success",
};

function fmtShort(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function CampaignPlannerPage() {
  const listFn = useServerFn(listCampaigns);
  const getFn = useServerFn(getCampaign);
  const delFn = useServerFn(deleteCampaign);
  const updateFn = useServerFn(updateCalendarItem);
  const qc = useQueryClient();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<CampaignItem | null>(null);

  const campaignsQ = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => listFn(),
  });

  const activeId = selectedId ?? campaignsQ.data?.campaigns[0]?.id ?? null;

  const detailQ = useQuery({
    queryKey: ["campaign", activeId],
    queryFn: () => getFn({ data: { id: activeId! } }),
    enabled: !!activeId,
  });

  const items = (detailQ.data?.items ?? []) as CampaignItem[];
  const campaign = detailQ.data?.campaign;

  const stats = useMemo(() => {
    const total = items.length;
    const posted = items.filter((i) => i.status === "posted").length;
    const scheduled = items.filter((i) => i.status === "scheduled").length;
    const drafted = items.filter((i) => i.status === "drafted").length;
    return { total, posted, scheduled, drafted };
  }, [items]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["campaign", activeId] });
    qc.invalidateQueries({ queryKey: ["campaigns"] });
  };

  const handleQuickStatus = async (id: string, status: string) => {
    try {
      await updateFn({ data: { id, status: status as any } });
      refresh();
    } catch {
      toast.error("Update failed");
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("Delete this campaign and all its days?")) return;
    try {
      await delFn({ data: { id } });
      toast.success("Campaign deleted");
      setSelectedId(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  // Empty state — no campaigns yet
  if (!campaignsQ.isLoading && (campaignsQ.data?.campaigns.length ?? 0) === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl gradient-accent shadow-ig">
            <Rocket className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Campaign Planner</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Generate a full multi-platform content campaign — goal, audience, hooks, visuals, captions, CTAs — grounded in your Research DNA. Then edit, produce, and publish each day from one place.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button size="lg" onClick={() => setWizardOpen(true)} className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Start a new campaign
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-1.5">
              <Link to="/research"><Microscope className="h-4 w-4" /> Run research first</Link>
            </Button>
          </div>
          <Separator className="my-8" />
          <div className="grid gap-4 text-left sm:grid-cols-3">
            {[
              { icon: Target, title: "Goal-driven", body: "Every day laddered to a single business goal — no random posting." },
              { icon: Users, title: "Audience-tuned", body: "Hooks and CTAs written to the audience you describe." },
              { icon: Share2, title: "Multi-platform", body: "One campaign, per-platform captions and formats." },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border border-border p-4">
                <f.icon className="h-4 w-4 text-accent-primary" />
                <div className="mt-2 text-sm font-semibold">{f.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{f.body}</div>
              </div>
            ))}
          </div>
        </div>

        <CampaignWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onCreated={(id) => { setSelectedId(id); refresh(); }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 lg:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaign Planner</h1>
          <p className="text-sm text-muted-foreground">Your content operating system — plan, produce, publish.</p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Campaign list */}
        <aside className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">Campaigns</div>
          {(campaignsQ.data?.campaigns ?? []).map((c: any) => {
            const cnt = campaignsQ.data!.counts[c.id] ?? { total: 0, posted: 0, scheduled: 0 };
            const pct = cnt.total ? Math.round((cnt.posted / cnt.total) * 100) : 0;
            const active = c.id === activeId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`group w-full rounded-lg border p-3 text-left transition-all ${
                  active ? "border-accent-primary bg-accent-primary/5" : "border-border hover:border-border-strong"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{c.goal}</div>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 ${active ? "text-accent-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(c.platforms ?? []).slice(0, 4).map((p: string) => (
                    <Badge key={p} variant="secondary" className="text-[9px] uppercase">{p}</Badge>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{cnt.posted}/{cnt.total} posted</span>
                  <span>{pct}%</span>
                </div>
                <Progress value={pct} className="mt-1 h-1" />
              </button>
            );
          })}
        </aside>

        {/* Detail */}
        <section className="min-w-0">
          {detailQ.isLoading || !campaign ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[0,1,2,3,4,5].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Campaign stats bar */}
              <div className="mb-5 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{campaign.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]"><Target className="mr-1 h-3 w-3" /> {campaign.goal}</Badge>
                      <Badge variant="outline" className="text-[10px]"><Users className="mr-1 h-3 w-3" /> {campaign.business_type}</Badge>
                      {campaign.research_report_id && (
                        <Badge variant="outline" className="text-[10px] border-accent-primary/40 text-accent-primary">
                          <Microscope className="mr-1 h-3 w-3" /> Research-grounded
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteCampaign(campaign.id)} className="text-status-error hover:bg-status-error/10">
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Total", val: stats.total, hint: `${campaign.duration_days} days` },
                    { label: "Drafted", val: stats.drafted },
                    { label: "Scheduled", val: stats.scheduled },
                    { label: "Posted", val: stats.posted, hint: stats.total ? `${Math.round((stats.posted / stats.total) * 100)}%` : "0%" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border bg-background p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <div className="text-2xl font-bold">{s.val}</div>
                        {s.hint && <div className="text-xs text-muted-foreground">{s.hint}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Views */}
              <Tabs defaultValue="board">
                <TabsList>
                  <TabsTrigger value="board" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Board</TabsTrigger>
                  <TabsTrigger value="kanban" className="gap-1.5"><Layers3 className="h-3.5 w-3.5" /> Kanban</TabsTrigger>
                  <TabsTrigger value="list" className="gap-1.5"><ListIcon className="h-3.5 w-3.5" /> List</TabsTrigger>
                  <TabsTrigger value="calendar" className="gap-1.5"><CalIcon className="h-3.5 w-3.5" /> Calendar</TabsTrigger>
                </TabsList>

                {/* BOARD (week-grouped rich cards) */}
                <TabsContent value="board" className="mt-4">
                  <BoardView items={items} onOpen={setOpenItem} onStatus={handleQuickStatus} />
                </TabsContent>

                {/* KANBAN by status */}
                <TabsContent value="kanban" className="mt-4">
                  <KanbanView items={items} onOpen={setOpenItem} />
                </TabsContent>

                {/* LIST */}
                <TabsContent value="list" className="mt-4">
                  <ListView items={items} onOpen={setOpenItem} />
                </TabsContent>

                {/* CALENDAR (month grid) */}
                <TabsContent value="calendar" className="mt-4">
                  <CalendarView items={items} onOpen={setOpenItem} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </section>
      </div>

      <CampaignWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={(id) => { setSelectedId(id); refresh(); }}
      />
      <CampaignItemDrawer
        item={openItem}
        open={!!openItem}
        onOpenChange={(o) => !o && setOpenItem(null)}
        onChanged={refresh}
      />
    </div>
  );
}

// ═════════════════════════════════════════ Views

function ItemCard({ it, onOpen }: { it: CampaignItem; onOpen: (i: CampaignItem) => void }) {
  return (
    <button
      onClick={() => onOpen(it)}
      className={`group text-left w-full rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-border-strong ${
        it.status === "posted" ? "opacity-60" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-muted-foreground">{fmtShort(it.scheduled_for)}</span>
        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${TYPE_STYLES[it.post_type || ""] || "bg-muted text-muted-foreground border-border"}`}>
          {it.post_type || "Post"}
        </span>
      </div>
      <p className="text-sm font-semibold leading-snug line-clamp-2">{it.title || it.hook || "Untitled"}</p>
      {it.hook && it.title && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{it.hook}</p>}
      {it.visual_idea && <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2">🎬 {it.visual_idea}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {(it.platforms ?? []).slice(0, 4).map((p) => (
          <Badge key={p} variant="secondary" className="text-[9px] uppercase">{p}</Badge>
        ))}
        <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ${STATUS_STYLES[it.status] || ""}`}>{it.status}</span>
      </div>
    </button>
  );
}

function BoardView({ items, onOpen }: { items: CampaignItem[]; onOpen: (i: CampaignItem) => void; onStatus: (id: string, s: string) => void }) {
  const grouped = items.reduce<Record<string, CampaignItem[]>>((acc, it) => {
    const d = new Date(it.scheduled_for + "T00:00:00");
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    (acc[key] ||= []).push(it);
    return acc;
  }, {});
  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([weekStart, weekItems]) => (
        <section key={weekStart}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Week of {fmtShort(weekStart)}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {weekItems.map((it) => <ItemCard key={it.id} it={it} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function KanbanView({ items, onOpen }: { items: CampaignItem[]; onOpen: (i: CampaignItem) => void }) {
  const cols: Array<{ key: string; label: string }> = [
    { key: "planned", label: "Planned" },
    { key: "drafted", label: "Drafted" },
    { key: "scheduled", label: "Scheduled" },
    { key: "posted", label: "Posted" },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cols.map((c) => {
        const bucket = items.filter((i) => i.status === c.key);
        return (
          <div key={c.key} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{c.label}</div>
              <Badge variant="secondary" className="text-[10px]">{bucket.length}</Badge>
            </div>
            <div className="space-y-2">
              {bucket.length === 0 && <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">Nothing here</div>}
              {bucket.map((it) => <ItemCard key={it.id} it={it} onOpen={onOpen} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ items, onOpen }: { items: CampaignItem[]; onOpen: (i: CampaignItem) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-widest text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">Title / Hook</th>
            <th className="px-3 py-2 text-left">Platforms</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} onClick={() => onOpen(it)} className="cursor-pointer border-t border-border hover:bg-muted/30">
              <td className="px-3 py-2 font-mono text-xs">{fmtShort(it.scheduled_for)}</td>
              <td className="px-3 py-2">
                <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${TYPE_STYLES[it.post_type || ""] || ""}`}>{it.post_type || "Post"}</span>
              </td>
              <td className="px-3 py-2">
                <div className="font-semibold line-clamp-1">{it.title || it.hook || "Untitled"}</div>
                {it.title && it.hook && <div className="text-xs text-muted-foreground line-clamp-1">{it.hook}</div>}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">{(it.platforms ?? []).map((p) => <Badge key={p} variant="secondary" className="text-[9px] uppercase">{p}</Badge>)}</div>
              </td>
              <td className="px-3 py-2">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase ${STATUS_STYLES[it.status] || ""}`}>{it.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarView({ items, onOpen }: { items: CampaignItem[]; onOpen: (i: CampaignItem) => void }) {
  if (items.length === 0) return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No items</div>;
  const first = new Date(items[0].scheduled_for + "T00:00:00");
  const monthStart = new Date(first.getFullYear(), first.getMonth(), 1);
  const monthEnd = new Date(first.getFullYear(), first.getMonth() + 2, 0); // cover 2 months
  const days: Date[] = [];
  const cursor = new Date(monthStart);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  while (cursor <= monthEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  const map = new Map<string, CampaignItem[]>();
  for (const it of items) {
    const arr = map.get(it.scheduled_for) ?? [];
    arr.push(it);
    map.set(it.scheduled_for, arr);
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const iso = d.toISOString().slice(0, 10);
          const dayItems = map.get(iso) ?? [];
          const inMonth = d.getMonth() === monthStart.getMonth() || d.getMonth() === monthStart.getMonth() + 1;
          return (
            <div key={i} className={`min-h-[100px] border-b border-r border-border p-1.5 ${inMonth ? "" : "bg-muted/20 opacity-60"}`}>
              <div className="mb-1 text-[10px] font-mono text-muted-foreground">{d.getDate()}</div>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map((it) => (
                  <button
                    key={it.id}
                    onClick={() => onOpen(it)}
                    className={`w-full truncate rounded px-1.5 py-1 text-left text-[10px] border ${TYPE_STYLES[it.post_type || ""] || "bg-muted"}`}
                    title={it.hook ?? undefined}
                  >
                    {it.title || it.hook || it.post_type}
                  </button>
                ))}
                {dayItems.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayItems.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
